import chalk from "chalk";
import { resolveNodeValue } from "./utils.js";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import fs from "fs";
import path from "path";
import { Chunks } from "../../utility/interfaces.js";
const traverse = _traverse.default;

const resolveFetch = async (chunks: Chunks, directory: string) => {
    console.log(chalk.cyan("[i] Resolving fetch instances"));

    for (const chunk of Object.values(chunks)) {
        if (!chunk.containsFetch || !chunk.file) {
            continue;
        }

        const filePath = path.join(directory, chunk.file);
        let fileContent: string;

        try {
            fileContent = fs.readFileSync(filePath, "utf-8");
        } catch (error) {
            console.log(chalk.red(`[!] Could not read file: ${filePath}`));
            continue;
        }

        let fileAst;
        try {
            fileAst = parser.parse(fileContent, {
                sourceType: "module",
                plugins: ["jsx", "typescript"],
                errorRecovery: true,
            });
        } catch (err) {
            console.log(
                chalk.red(
                    `[!] Failed to parse file: ${filePath}. Error: ${err.message}`
                )
            );
            continue;
        }

        const fetchAliases = new Set();

        // Pass 1: Find fetch aliases on the full file AST
        traverse(fileAst, {
            VariableDeclarator(path) {
                if (path.node.id.type === "Identifier" && path.node.init) {
                    if (
                        path.node.init.type === "Identifier" &&
                        path.node.init.name === "fetch"
                    ) {
                        const binding = path.scope.getBinding(
                            path.node.id.name
                        );
                        if (binding) fetchAliases.add(binding);
                    }
                }
            },
        });

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
                            `[+] Found fetch call in chunk ${chunk.id} (${chunk.file}) at L${
                                path.node.loc.start.line
                            }`
                        )
                    );
                    const args = path.node.arguments;
                    if (args.length > 0) {
                        const url = resolveNodeValue(args[0], path.scope);
                        console.log(chalk.green(`    URL: ${url}`));

                        if (args.length > 1) {
                            const options = resolveNodeValue(
                                args[1],
                                path.scope
                            );
                            if (
                                typeof options === "object" &&
                                options !== null
                            ) {
                                console.log(
                                    chalk.green(
                                        `    Method: ${options.method || "GET"}`
                                    )
                                );
                                if (options.headers)
                                    console.log(
                                        chalk.green(
                                            `    Headers: ${JSON.stringify(options.headers)}`
                                        )
                                    );
                                if (options.body)
                                    console.log(
                                        chalk.green(
                                            `    Body: ${JSON.stringify(options.body)}`
                                        )
                                    );
                            } else {
                                console.log(
                                    chalk.yellow(`    Options: ${options}`)
                                );
                            }
                        }
                    }
                }
            },
        });
    }
};

export default resolveFetch;
