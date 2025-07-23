import chalk from "chalk";
import { resolveNodeValue, resolveStringOps } from "./utils.js";
import fs from "fs";
import { Chunks } from "../../utility/interfaces.js";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import * as globals from "../../utility/globals.js";
import { Node } from "@babel/types";
const traverse = _traverse.default;

const resolveAxios = async (chunks: Chunks, directory: string) => {
    console.log(chalk.cyan("[i] Resolving axios instances"));

    let axiosInstancesExists = false;
    let axiosExportedTo: string[] = [];
    let axiosImportedTo: { [key: string]: string } = {};

    // first get those which have axios client
    for (const chunkName of Object.keys(chunks)) {
        if (chunks[chunkName].isAxiosClient) {
            axiosInstancesExists = true;
            axiosExportedTo.push(chunkName);
        }
    }

    // now, see which ones import those
    for (const chunkName of Object.keys(chunks)) {
        // iterate through the names of the axios clients
        for (const axiosExportFunctionId of axiosExportedTo) {
            // iterate through the imports of the all the chunks, and see which ones have axios clients imported
            for (const importName of chunks[chunkName].imports) {
                if (importName === axiosExportFunctionId) {
                    axiosImportedTo[chunkName] = axiosExportFunctionId;

                    console.log(
                        chalk.green(
                            `[✓] ${chunkName} imports axios client ${axiosExportFunctionId}`
                        )
                    );
                }
            }
        }
    }

    // once you've got the functions which use axios clients, iterate through them and try to resolve them
    if (axiosInstancesExists && Object.keys(axiosImportedTo).length > 0) {
        // iterate through the functions which uses them
        for (const chunkName of Object.keys(axiosImportedTo)) {
            // get the code of the chunk
            const chunkCode = chunks[chunkName].code;

            const ast = parser.parse(chunkCode, {
                sourceType: "unambiguous",
                plugins: ["jsx", "typescript"],
                errorRecovery: true,
            });

            // get number of arguments to function. If it is three, then get the third argument
            let thirdArg = "";
            traverse(ast, {
                FunctionDeclaration(path) {
                    const args = path.node.params;
                    if (args.length === 3) {
                        thirdArg = args[2].name;
                    }
                },
                AssignmentExpression(path) {
                    const args = path.node.right.params;
                    if (args?.length === 3) {
                        thirdArg = args[2].name;
                    }
                },
            });

            if (thirdArg !== "") {
                let axiosInstance = "";

                // get the var name for something like `a = thirdArg(<some_number>)`
                traverse(ast, {
                    VariableDeclarator(path) {
                        // get the assignment value
                        const varName = path.node.id.name;
                        const assignmentValue = path.node.init;
                        if (assignmentValue?.type === "CallExpression") {
                            // see if it is calling the third arg
                            if (assignmentValue.callee.name === thirdArg) {
                                // finally, check if the first argument is equal to the axios instance
                                const thisFunctionAssignmentValue =
                                    assignmentValue.arguments[0].value.toString();
                                const targetFunctionAssignmentValue =
                                    axiosImportedTo[chunkName];
                                if (
                                    thisFunctionAssignmentValue ===
                                    targetFunctionAssignmentValue
                                ) {
                                    // print the variable name
                                    console.log(
                                        chalk.green(
                                            `[✓] ${chunkName} uses axios client initialized in ${varName}`
                                        )
                                    );
                                    axiosInstance = varName;
                                }
                            }
                        }
                    },
                });

                if (axiosInstance !== "") {
                    // now that we've got the axios instance, we need to find where it is being called
                    // for example, if the axios instance is `a`, then it is being called like `a.b.get(...)`
                    traverse(ast, {
                        MemberExpression(path) {
                            if (
                                path.node.object.type === "MemberExpression" &&
                                path.node.object.object.name === axiosInstance
                            ) {
                                // This handles o.A.post
                                const codeSnippet =
                                    chunkCode.split("\n")[
                                        path.node.loc.start.line - 1
                                    ];
                                const firstProp =
                                    path.node.object.property.name; // A
                                const secondProp = path.node.property.name; // post

                                let axiosFirstArg: Node;
                                let axiosSecondArg: Node;

                                let axiosFirstArgText: string;
                                let axiosSecondArgText: string;

                                // define some arguments to be finally printed
                                let callUrl: string;
                                let callMethod: string;
                                let callHeaders: { [key: string]: string };
                                let callBody: string;
                                let functionFile: string;
                                let functionFileLine: number;
                                let chunkId: string;

                                // now, resolve the arguments
                                if (path.parentPath.isCallExpression()) {
                                    const args = path.parentPath.node.arguments;
                                    if (args.length > 0) {
                                        axiosFirstArg = args[0];
                                        axiosFirstArgText = chunkCode.slice(
                                            axiosFirstArg.start,
                                            axiosFirstArg.end
                                        );

                                        // try to resolve this by seeing where this ends at
                                        // the code snippet is `"/api/teams/".concat(i, "/members")`

                                        // so, first of all see if this is a string operation

                                        // regex for only concat ops
                                        const concatRegex =
                                            /".*"(\.concat\(.+\))+/;
                                        if (
                                            concatRegex.test(axiosFirstArgText)
                                        ) {
                                            // now, resolve it

                                            // assuming that the code is like `"/api/teams/".concat(i, "/members")`
                                            // Replace variables with placeholders using resolveStringOps utility
                                            const varsReplaced =
                                                resolveStringOps(
                                                    axiosFirstArgText
                                                );

                                            callUrl = varsReplaced;
                                        }
                                    }
                                    if (args.length > 1) {
                                        axiosSecondArg = args[1];
                                        axiosSecondArgText = chunkCode.slice(
                                            axiosSecondArg.start,
                                            axiosSecondArg.end
                                        );
                                    }
                                }

                                // console.log(axiosFirstArgText, axiosSecondArgText);

                                // since it has got the two arguments, check their types

                                // first resolve the chunk id
                                chunkId = chunkName;

                                // now, get the function file
                                functionFile =
                                    directory + "/" + chunks[chunkId].file;

                                // now, get the function file line
                                // to do so, iterate through the lines of code, and see if it is equal to codeSnippet
                                const codeFileContent = fs.readFileSync(
                                    functionFile,
                                    "utf-8"
                                );
                                for (
                                    let i = 0;
                                    i < codeFileContent.split("\n").length;
                                    i++
                                ) {
                                    if (
                                        codeFileContent.split("\n")[i] ===
                                        codeSnippet
                                    ) {
                                        functionFileLine = i + 1;
                                        break;
                                    }
                                }

                                // resolve the URL first in case it hasn't been resolved earlier
                                if (callUrl === undefined) {
                                    if (
                                        axiosFirstArg?.type === "StringLiteral"
                                    ) {
                                        callUrl = axiosFirstArg.value;
                                    } else {
                                        // since it isn't a string, we have to resolve it
                                        const callExpressionPath =
                                            path.parentPath;
                                        // will also pass the code snippet just in case it could resolve it
                                        callUrl = resolveNodeValue(
                                            axiosFirstArg,
                                            callExpressionPath.scope,
                                            axiosFirstArgText
                                        );
                                    }
                                }

                                // now, go for the method
                                if (
                                    secondProp === "post" ||
                                    secondProp === "POST"
                                ) {
                                    callMethod = "POST";
                                } else if (
                                    secondProp === "get" ||
                                    secondProp === "GET"
                                ) {
                                    callMethod = "GET";
                                } else if (
                                    secondProp === "put" ||
                                    secondProp === "PUT"
                                ) {
                                    callMethod = "PUT";
                                } else if (
                                    secondProp === "delete" ||
                                    secondProp === "DELETE"
                                ) {
                                    callMethod = "DELETE";
                                } else if (
                                    secondProp === "patch" ||
                                    secondProp === "PATCH"
                                ) {
                                    callMethod = "PATCH";
                                } else if (
                                    secondProp === "head" ||
                                    secondProp === "HEAD"
                                ) {
                                    callMethod = "HEAD";
                                } else if (
                                    secondProp === "options" ||
                                    secondProp === "OPTIONS"
                                ) {
                                    callMethod = "OPTIONS";
                                } else if (
                                    secondProp === "trace" ||
                                    secondProp === "TRACE"
                                ) {
                                    callMethod = "TRACE";
                                } else if (
                                    secondProp === "connect" ||
                                    secondProp === "CONNECT"
                                ) {
                                    callMethod = "CONNECT";
                                } else {
                                    callMethod = "UNKNOWN";
                                }

                                // now, get the second argument
                                if (axiosSecondArgText) {
                                    // see if axios second arg is an object in type {[key]: any, ...}
                                    // do this on axiosSecondArg
                                    if (
                                        axiosSecondArg?.type ===
                                        "ObjectExpression"
                                    ) {
                                        // see if it contains data
                                        let dataFound = false;

                                        // iterate through the properties
                                        for (
                                            let i = 0;
                                            i <
                                            axiosSecondArg.properties.length;
                                            i++
                                        ) {
                                            const property =
                                                axiosSecondArg.properties[i];
                                            // @ts-ignore
                                            if (property.key.name === "data") {
                                                dataFound = true;
                                                break;
                                            }
                                        }

                                        // if data is found, get the value of the `data` property
                                        if (dataFound) {
                                            // value of data
                                            const dataValue: Node =
                                                axiosSecondArg.properties.find(
                                                    (property) =>
                                                        // @ts-ignore
                                                        property.key.name ===
                                                        "data"
                                                );
                                            // slice the string
                                            // @ts-ignore
                                            const dataValueText =
                                                chunkCode.slice(
                                                    // @ts-ignore
                                                    dataValue.value.start,
                                                    // @ts-ignore
                                                    dataValue.value.end
                                                );

                                            callBody = dataValueText.replace(
                                                /\n\s+/g,
                                                " "
                                            );
                                        } else {
                                            // since it is not found, the second value should be the body
                                            const bodyValueText =
                                                chunkCode.slice(
                                                    axiosSecondArg.start,
                                                    axiosSecondArg.end
                                                );

                                            callBody = bodyValueText.replace(
                                                /\n\s+/g,
                                                " "
                                            );
                                        }
                                    }
                                }

                                // finally, print the human readable output
                                console.log(
                                    chalk.blue(
                                        `[+] Found axios call in chunk ${chunkId} (${functionFile}) at L${functionFileLine}`
                                    )
                                );
                                console.log(chalk.green(`    URL: ${callUrl}`));
                                console.log(
                                    chalk.green(`    Method: ${callMethod}`)
                                );

                                if (callBody) {
                                    console.log(
                                        chalk.green(`    Body: ${callBody}`)
                                    );
                                }

                                globals.addOpenapiOutput({
                                    url: callUrl || "",
                                    method: callMethod || "",
                                    path: callUrl || "",
                                    headers: callHeaders || {},
                                    body: callBody || "",
                                    chunkId: chunkId,
                                    functionFile: functionFile,
                                    functionFileLine: functionFileLine,
                                });
                            }
                        },
                    });
                } else {
                    console.log(
                        chalk.yellow(
                            "[!] No axios instance found in " + chunkName
                        )
                    );
                }
            } else {
                console.log(chalk.yellow("[!] No function uses axios client"));
            }
        }
    } else {
        console.log(chalk.yellow("[!] No axios instances found"));
        return;
    }

    if (!axiosInstancesExists) {
        console.log(chalk.yellow("[!] No axios instances found"));
        return;
    }
};

export default resolveAxios;
