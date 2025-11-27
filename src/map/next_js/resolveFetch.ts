import chalk from "chalk";
import { resolveNodeValue, substituteVariablesInString } from "./utils.js";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import fs from "fs";
import path from "path";
import { Chunks } from "../../utility/interfaces.js";
import { getThirdArg } from "./resolveAxios.js";
import { Node } from "@babel/types";
const traverse = _traverse.default;
import * as globals from "../../utility/globals.js";

/**
 * Finds the function name that wraps a fetch call.
 */
const getFunctionNameForFetchCall = (fetchCallPath: any): string | null => {
    let currentPath = fetchCallPath;

    // Traverse up the AST to find the containing function
    while (currentPath) {
        if (currentPath.isFunctionDeclaration()) {
            return currentPath.node.id?.name || null;
        }
        if (currentPath.isVariableDeclarator()) {
            const init = currentPath.node.init;
            if (init && (init.type === "FunctionExpression" || init.type === "ArrowFunctionExpression")) {
                return currentPath.node.id.type === "Identifier" ? currentPath.node.id.name : null;
            }
        }
        if (currentPath.isFunctionExpression() || currentPath.isArrowFunctionExpression()) {
            // Check if parent is a variable declarator
            const parent = currentPath.parent;
            if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
                return parent.id.name;
            }
        }
        currentPath = currentPath.parentPath;
    }
    return null;
};

/**
 * Finds which export in a chunk returns a given function name.
 */
const findExportForFunction = (chunkCode: string, functionName: string, exportNames: string[]): string | null => {
    if (!exportNames || exportNames.length === 0) return null;

    try {
        const ast = parser.parse(chunkCode, {
            sourceType: "module",
            plugins: ["jsx", "typescript"],
            errorRecovery: true,
        });

        let foundExport: string | null = null;

        traverse(ast, {
            // Pattern 1: t.d(r, { $C: () => i, ... })
            CallExpression(path) {
                const callee = path.node.callee;
                if (
                    callee.type === "MemberExpression" &&
                    callee.property.type === "Identifier" &&
                    callee.property.name === "d" &&
                    path.node.arguments.length >= 2
                ) {
                    const secondArg = path.node.arguments[1];
                    if (secondArg.type === "ObjectExpression") {
                        for (const prop of secondArg.properties) {
                            if (
                                prop.type === "ObjectProperty" &&
                                prop.key.type === "Identifier" &&
                                exportNames.includes(prop.key.name)
                            ) {
                                const value = prop.value;

                                // Pattern: exportName: () => functionName
                                if (
                                    value.type === "ArrowFunctionExpression" &&
                                    value.body.type === "Identifier" &&
                                    value.body.name === functionName
                                ) {
                                    foundExport = prop.key.name;
                                    path.stop();
                                    return;
                                }
                            }
                        }
                    }
                }
            },
            // Pattern 2: { exportName: () => functionName } (direct object)
            ObjectProperty(path) {
                if (path.node.key.type === "Identifier" && exportNames.includes(path.node.key.name)) {
                    const value = path.node.value;

                    // Pattern: exportName: () => functionName
                    if (
                        value.type === "ArrowFunctionExpression" &&
                        value.body.type === "Identifier" &&
                        value.body.name === functionName
                    ) {
                        foundExport = path.node.key.name;
                        path.stop();
                    }
                    // Pattern: exportName: function() { return functionName }
                    else if (value.type === "FunctionExpression" && value.body.type === "BlockStatement") {
                        const returnStmt = value.body.body.find((stmt: any) => stmt.type === "ReturnStatement");
                        if (returnStmt?.argument?.type === "Identifier" && returnStmt.argument.name === functionName) {
                            foundExport = path.node.key.name;
                            path.stop();
                        }
                    }
                }
            },
        });

        return foundExport;
    } catch (e) {
        return null;
    }
};

/**
 * Traces fetch function calls across chunks to resolve body parameters.
 */
const traceFetchFunctionCalls = (
    fetchChunkId: string,
    exportName: string,
    functionName: string,
    chunks: Chunks,
    directory: string
): any => {
    // Find chunks that import the fetch chunk
    for (const [callerChunkId, callerChunk] of Object.entries(chunks)) {
        if (!callerChunk.imports || !callerChunk.file) continue;

        // Check if this chunk imports our fetch chunk
        if (!callerChunk.imports.includes(fetchChunkId)) continue;

        console.log(
            chalk.cyan(`    [\u2192] Chunk ${callerChunkId} imports fetch chunk ${fetchChunkId}, tracing calls...`)
        );

        // Load the caller chunk code
        const callerFilePath = path.join(directory, callerChunk.file);
        let callerCode: string;
        try {
            callerCode = fs.readFileSync(callerFilePath, "utf-8");
        } catch (e) {
            continue;
        }

        // Parse caller chunk
        let callerAst: Node;
        try {
            callerAst = parser.parse(callerCode, {
                sourceType: "module",
                plugins: ["jsx", "typescript"],
                errorRecovery: true,
            });
        } catch (e) {
            continue;
        }

        // Get the third arg (webpack require function name)
        const thirdArgName = getThirdArg(callerAst);
        if (!thirdArgName) continue;

        // Find calls to the exported function
        const callArguments: any[] = [];

        traverse(callerAst, {
            CallExpression(path) {
                const callee = path.node.callee;

                // Pattern 1: (0, varName.exportName)(...)
                if (callee.type === "SequenceExpression" && callee.expressions.length === 2) {
                    const secondExpr = callee.expressions[1];
                    if (
                        secondExpr.type === "MemberExpression" &&
                        secondExpr.property.type === "Identifier" &&
                        secondExpr.property.name === exportName
                    ) {
                        callArguments.push(...path.node.arguments);
                    }
                }
                // Pattern 2: varName.exportName(...)
                else if (
                    callee.type === "MemberExpression" &&
                    callee.property.type === "Identifier" &&
                    callee.property.name === exportName
                ) {
                    callArguments.push(...path.node.arguments);
                }
                // Pattern 3: Direct call after import resolution
                else if (callee.type === "Identifier") {
                    // Check if this identifier is bound to our exported function
                    const binding = path.scope.getBinding(callee.name);
                    if (binding && binding.path.isVariableDeclarator()) {
                        const init = binding.path.node.init;
                        if (
                            init &&
                            init.type === "MemberExpression" &&
                            init.property.type === "Identifier" &&
                            init.property.name === exportName
                        ) {
                            callArguments.push(...path.node.arguments);
                        }
                    }
                }
            },
        });

        if (callArguments.length > 0) {
            console.log(
                chalk.green(
                    `    [\u2713] Found ${callArguments.length} call(s) to ${exportName} in chunk ${callerChunkId}`
                )
            );
            // Return the first argument (usually the body object)
            return callArguments[0];
        }
    }

    return null;
};

/**
 * Resolves fetch instances in the given chunks.
 * @param {Chunks} chunks - A dictionary of chunk names to chunk objects.
 * @param {string} directory - The directory of the chunk file.
 */
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

        // Get the third arg (webpack require function name) for this chunk
        const thirdArgName = getThirdArg(fileAst);

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

                        let url = resolveNodeValue(args[0], path.scope, argText, "fetch");

                        // Substitute any [var X] or [MemberExpression -> X] placeholders with actual values from the chunk
                        if (typeof url === "string" && (url.includes("[var ") || url.includes("[MemberExpression"))) {
                            const substitutedUrl = substituteVariablesInString(url, fileContent, chunks, thirdArgName);
                            if (substitutedUrl !== url) {
                                console.log(
                                    chalk.cyan(`    [i] Resolved variables in URL: ${url} -> ${substitutedUrl}`)
                                );
                                url = substitutedUrl;
                            }
                        }

                        callUrl = url;
                        console.log(chalk.green(`    URL: ${url}`));

                        if (args.length > 1) {
                            let options = resolveNodeValue(
                                args[1],
                                path.scope,
                                "",
                                "fetch",
                                fileContent,
                                chunks,
                                thirdArgName
                            );

                            // Try to trace fetch function exports for better body resolution
                            const functionName = getFunctionNameForFetchCall(path);
                            if (functionName && chunk.exports && chunk.exports.length > 0) {
                                console.log(
                                    chalk.cyan(
                                        `    [i] Fetch is wrapped in function '${functionName}', checking for exports...`
                                    )
                                );

                                const exportName = findExportForFunction(fileContent, functionName, chunk.exports);
                                if (exportName) {
                                    console.log(
                                        chalk.cyan(
                                            `    [i] Function '${functionName}' exported as '${exportName}', tracing calls...`
                                        )
                                    );

                                    const actualCallArg = traceFetchFunctionCalls(
                                        chunk.id,
                                        exportName,
                                        functionName,
                                        chunks,
                                        directory
                                    );

                                    if (actualCallArg) {
                                        // Resolve the actual call argument to get the real body
                                        const resolvedArg = resolveNodeValue(actualCallArg, path.scope, "", "fetch");
                                        if (resolvedArg && typeof resolvedArg === "object") {
                                            console.log(
                                                chalk.green(
                                                    `    [✓] Resolved actual body from caller: ${JSON.stringify(resolvedArg)}`
                                                )
                                            );
                                            // Update options.body with the resolved value
                                            if (typeof options === "object" && options !== null) {
                                                options = { ...options, body: resolvedArg };
                                            }
                                        }
                                    }
                                }
                            }

                            if (typeof options === "object" && options !== null) {
                                // Substitute variables in headers
                                if (options.headers && typeof options.headers === "object") {
                                    const resolvedHeaders: { [key: string]: string } = {};
                                    for (const [key, value] of Object.entries(options.headers)) {
                                        const resolvedKey =
                                            typeof key === "string"
                                                ? substituteVariablesInString(key, fileContent, chunks, thirdArgName)
                                                : String(key);
                                        const resolvedValue =
                                            typeof value === "string"
                                                ? substituteVariablesInString(value, fileContent, chunks, thirdArgName)
                                                : String(value);
                                        resolvedHeaders[resolvedKey] = resolvedValue;
                                    }
                                    options.headers = resolvedHeaders;
                                }

                                // Substitute variables in body if it's an object with string values
                                if (options.body && typeof options.body === "object") {
                                    const resolvedBody: any = {};
                                    for (const [key, value] of Object.entries(options.body)) {
                                        const resolvedValue =
                                            typeof value === "string"
                                                ? substituteVariablesInString(value, fileContent, chunks, thirdArgName)
                                                : value;
                                        resolvedBody[key] = resolvedValue;
                                    }
                                    options.body = resolvedBody;
                                }

                                console.log(chalk.green(`    Method: ${options.method || "UNKNOWN"}`));
                                callMethod = options.method || "UNKNOWN";
                                if (options.headers)
                                    console.log(chalk.green(`    Headers: ${JSON.stringify(options.headers)}`));
                                if (options.body) console.log(chalk.green(`    Body: ${JSON.stringify(options.body)}`));
                                callHeaders = options.headers || {};
                                callBody =
                                    typeof options.body === "object"
                                        ? JSON.stringify(options.body)
                                        : options.body || "";
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
