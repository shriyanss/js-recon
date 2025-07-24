import chalk from "chalk";
import { resolveNodeValue } from "./utils.js";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import fs from "fs";
import path from "path";
import { Chunks } from "../../utility/interfaces.js";
const traverse = _traverse.default;
import * as globals from "../../utility/globals.js";

const resolveFetch = async (chunks: Chunks, directory: string) => {
    console.log(chalk.cyan("[i] Resolving fetch instances"));

    for (const chunk of Object.values(chunks)) {
        if (!chunk.containsFetch || !chunk.file) {
            continue;
        }

        // get the path of the file in which chunk is there
        const filePath = path.join(directory, chunk.file);
        let fileContent: string;

        // try to read the file
        try {
            fileContent = fs.readFileSync(filePath, "utf-8");
        } catch (error) {
            console.log(chalk.red(`[!] Could not read file: ${filePath}`));
            continue;
        }

        // try to parse the file
        let fileAst;
        try {
            fileAst = parser.parse(fileContent, {
                sourceType: "module",
                plugins: ["jsx", "typescript"],
                errorRecovery: true,
            });
        } catch (err) {
            console.log(chalk.red(`[!] Failed to parse file: ${filePath}. Error: ${err.message}`));
            continue;
        }

        const fetchAliases = new Set();

        // Pass 1: Find fetch aliases on the full file AST
        traverse(fileAst, {
            VariableDeclarator(path) {
                if (path.node.id.type === "Identifier" && path.node.init) {
                    if (path.node.init.type === "Identifier" && path.node.init.name === "fetch") {
                        const binding = path.scope.getBinding(path.node.id.name);
                        if (binding) fetchAliases.add(binding);
                    }
                }
            },
        });

        // define some arguments to be finally printed
        let callUrl: string;
        let callMethod: string;
        let callHeaders: { [key: string]: string };
        let callBody: string;
        let chunkId: string;
        let functionFileLine: number;

        // Pass 2: Find and resolve fetch calls on the full file AST
        traverse(fileAst, {
            CallExpression(path) {
                let isFetchCall = false;
                const calleeName = path.node.callee.name;

                if (calleeName === "fetch") {
                    isFetchCall = true;
                } else {
                    const binding = path.scope.getBinding(calleeName);
                    if (binding && fetchAliases.has(binding)) {
                        isFetchCall = true;
                    }
                }

                if (isFetchCall) {
                    console.log(
                        chalk.blue(
                            `[+] Found fetch call in chunk ${chunk.id} ("${filePath}":${path.node.loc.start.line})`
                        )
                    );
                    functionFileLine = path.node.loc.start.line;
                    const args = path.node.arguments;
                    if (args.length > 0) {
                        // extract the whole code from the main file just in case the resolution fails
                        const argText = fileContent.slice(args[0].start, args[0].end).replace(/\n\s*/g, "");

                        const url = resolveNodeValue(args[0], path.scope, argText, "fetch");
                        callUrl = url;
                        console.log(chalk.green(`    URL: ${url}`));

                        if (args.length > 1) {
                            const options = resolveNodeValue(args[1], path.scope, "", "fetch");
                            if (typeof options === "object" && options !== null) {
                                console.log(chalk.green(`    Method: ${options.method || "UNKNOWN"}`));
                                callMethod = options.method || "UNKNOWN";
                                if (options.headers)
                                    console.log(chalk.green(`    Headers: ${JSON.stringify(options.headers)}`));
                                if (options.body) console.log(chalk.green(`    Body: ${JSON.stringify(options.body)}`));
                                callHeaders = options.headers || {};
                                callBody = options.body || "";
                            } else {
                                console.log(chalk.green(`    Options: ${options}`));
                            }

                            globals.addOpenapiOutput({
                                url: callUrl || "",
                                method: callMethod || "",
                                path: callUrl || "",
                                headers: callHeaders || {},
                                body: callBody || "",
                                chunkId: chunk.id,
                                functionFile: filePath,
                                functionFileLine: functionFileLine,
                            });
                        }
                    }
                }
            },
        });
    }
};

export default resolveFetch;
