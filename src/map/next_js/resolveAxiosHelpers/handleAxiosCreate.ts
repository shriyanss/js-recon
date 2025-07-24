import { NodePath } from "@babel/traverse";
import { MemberExpression } from "@babel/types";
import _traverse from "@babel/traverse";
import * as fs from "fs";
import * as fsPath from "path";
import chalk from "chalk";
import { Chunks } from "../../../utility/interfaces.js";
import * as globals from "../../../utility/globals.js";
import { astNodeToJsonString } from "./astNodeToJsonString.js";
import { resolveNodeValue } from "../utils.js";

const traverse = _traverse.default;

const findLineNumberByContent = (fileContent: string, targetLineContent: string): number => {
    const lines = fileContent.split("\n");
    const trimmedTarget = targetLineContent.trim();
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === trimmedTarget) {
            return i + 1;
        }
    }
    return 0;
};

export const handleAxiosCreate = (
    path: NodePath<MemberExpression>,
    ast: any,
    chunkCode: string,
    directory: string,
    chunkName: string,
    chunks: Chunks
): boolean => {
    let axiosCreateVarName = "";
    let axiosCreateLineNumber = 0;

    if (path.parentPath.isCallExpression() && path.parentPath.parentPath.isVariableDeclarator()) {
        const varDeclarator = path.parentPath.parentPath.node;
        if (varDeclarator.id.type === "Identifier") {
            axiosCreateVarName = varDeclarator.id.name;

            const axiosCreateLineContent = chunkCode.split("\n")[varDeclarator.loc.start.line - 1];

            const chunkFile = fs.readFileSync(fsPath.join(directory, chunks[chunkName].file), "utf-8");
            axiosCreateLineNumber = findLineNumberByContent(chunkFile, axiosCreateLineContent);
        }
    }

    if (axiosCreateVarName !== "") {
        console.log(
            chalk.magenta(
                `[✓] axios.create() assigned to '${axiosCreateVarName}' in chunk ${chunkName} ("${directory}/${chunks[chunkName].file}":${axiosCreateLineNumber})`
            )
        );

        traverse(ast, {
            CallExpression(callPath) {
                if (callPath.node.callee.type === "Identifier" && callPath.node.callee.name === axiosCreateVarName) {
                    const axiosCreateLineContent = chunkCode.split("\n")[callPath.node.loc.start.line - 1];

                    const chunkFile = fs.readFileSync(fsPath.join(directory, chunks[chunkName].file), "utf-8");
                    const axiosCreateCallLineNumber = findLineNumberByContent(chunkFile, axiosCreateLineContent);

                    // if there are no arguments, return
                    if (callPath.node.arguments && callPath.node.arguments.length === 0) {
                        return;
                    }

                    const firstArg = callPath.node.arguments[0];
                    let axiosCreateCallUrl: string;
                    let axiosCreateCallMethod: string;
                    let axiosCreateCallParams: any;
                    let axiosCreateCallHeaders: any;

                    console.log(
                        chalk.blue(
                            `[+] Found axios.create() call in chunk ${chunkName} ("${directory}/${chunks[chunkName].file}":${axiosCreateCallLineNumber})`
                        )
                    );

                    if (firstArg.type === "ObjectExpression") {
                        for (const property of firstArg.properties) {
                            if (property.type === "ObjectProperty" && property.key.type === "Identifier") {
                                if (property.key.name === "url") {
                                    if (property.value.type === "StringLiteral") {
                                        axiosCreateCallUrl = property.value.value;
                                    } else {
                                        const scope = callPath.scope;
                                        const nodeCode = chunkCode.slice(property.value.start, property.value.end);
                                        axiosCreateCallUrl = resolveNodeValue(property.value, scope, nodeCode, "axios");
                                    }
                                } else if (property.key.name === "method" && property.value.type === "StringLiteral") {
                                    axiosCreateCallMethod = property.value.value;
                                } else if (property.key.name === "params") {
                                    axiosCreateCallParams = astNodeToJsonString(property.value, chunkCode);
                                } else if (property.key.name === "headers") {
                                    if (property.value.type === "ObjectExpression") {
                                        axiosCreateCallHeaders = astNodeToJsonString(property.value, chunkCode);
                                    }
                                }
                            }
                        }
                    }

                    if (axiosCreateCallUrl) console.log(chalk.green(`    URL: ${axiosCreateCallUrl}`));
                    if (axiosCreateCallMethod)
                        console.log(chalk.green(`    Method: ${axiosCreateCallMethod.toUpperCase()}`));
                    if (axiosCreateCallParams) console.log(chalk.green(`    Params: ${axiosCreateCallParams}`));
                    if (axiosCreateCallHeaders) console.log(chalk.green(`    Headers: ${axiosCreateCallHeaders}`));

                    globals.addOpenapiOutput({
                        url: axiosCreateCallUrl || "",
                        method: axiosCreateCallMethod || "",
                        path: axiosCreateCallUrl || "",
                        headers: axiosCreateCallHeaders || {},
                        body: axiosCreateCallParams || "",
                        chunkId: chunkName,
                        functionFile: `${directory}/${chunks[chunkName].file}`,
                        functionFileLine: axiosCreateCallLineNumber,
                    });
                }
            },
        });
        return true; // Indicates that this was an axios.create() call and was handled.
    }
    return false;
};
