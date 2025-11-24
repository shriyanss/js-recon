import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { Chunks } from "../../../utility/interfaces.js";
import * as fs from "fs";
import chalk from "chalk";
import { resolveNodeValue, resolveStringOps } from "../utils.js";
import { astNodeToJsonString } from "./astNodeToJsonString.js";
import * as globals from "../../../utility/globals.js";
import globalConfig from "../../../globalConfig.js";

const getHttpMethod = (methodName: string): string | null => {
    const upperCaseMethod = methodName.toUpperCase();
    const httpMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
    if (httpMethods.includes(upperCaseMethod)) {
        return upperCaseMethod;
    }
    return null;
};

export const processDirectAxiosCall = (
    path: NodePath<t.MemberExpression>,
    chunkCode: string,
    directory: string,
    chunkName: string,
    chunks: Chunks,
    ast: t.Node
) => {
    const callMethodName = t.isIdentifier(path.node.property) ? path.node.property.name : "";
    const callMethod = getHttpMethod(callMethodName);

    if (!callMethod) {
        if (!globalConfig.axiosNonHttpMethods.includes(callMethodName)) {
            // console.log(chalk.yellow(`[!] Unknown or unhandled axios method: ${callMethodName}`));
        }
        return;
    }

    let callUrl: string;
    let callBody: string;
    let callHeaders: { [key: string]: string } = {};

    if (path.parentPath.isCallExpression()) {
        const args = path.parentPath.node.arguments;
        if (args.length > 0) {
            const axiosFirstArg = args[0];
            const axiosFirstArgText = chunkCode.slice(axiosFirstArg.start, axiosFirstArg.end);

            const concatRegex = /\".*\"(\\.concat\(.+\))+/;
            if (concatRegex.test(axiosFirstArgText)) {
                callUrl = resolveStringOps(axiosFirstArgText);
            } else if (t.isStringLiteral(axiosFirstArg)) {
                callUrl = axiosFirstArg.value;
            } else {
                callUrl = resolveNodeValue(axiosFirstArg, path.scope, axiosFirstArgText, "axios");
            }
        }

        if (args.length > 1) {
            const axiosSecondArg = args[1];
            callBody = astNodeToJsonString(axiosSecondArg, chunkCode);
        }

        if (args.length > 2) {
            const axiosThirdArg = args[2];
            if (t.isObjectExpression(axiosThirdArg)) {
                const headersProp = axiosThirdArg.properties.find(
                    (p) => t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === "headers"
                );

                if (t.isObjectProperty(headersProp) && t.isObjectExpression(headersProp.value)) {
                    const newHeaders = {};
                    for (const header of headersProp.value.properties) {
                        if (t.isObjectProperty(header)) {
                            let key: string;
                            if (t.isIdentifier(header.key)) {
                                key = header.key.name;
                            } else if (t.isStringLiteral(header.key)) {
                                key = header.key.value;
                            } else {
                                key = `[unresolved key]`;
                            }
                            const value = astNodeToJsonString(header.value, chunkCode);
                            newHeaders[key] = value;
                        }
                    }
                    callHeaders = newHeaders;
                }
            }
        }
    }

    const functionFile = `${directory}/${chunks[chunkName].file}`;
    const codeFileContent = fs.readFileSync(functionFile, "utf-8");
    const codeSnippet = chunkCode.split("\n")[path.node.loc.start.line - 1];
    let functionFileLine = -1;
    const lines = codeFileContent.split("\n");
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(codeSnippet.trim())) {
            functionFileLine = i + 1;
            break;
        }
    }

    console.log(
        chalk.blue(`[+] Found direct axios call in chunk ${chunkName} ("${functionFile}":${functionFileLine})`)
    );
    console.log(chalk.green(`    URL: ${callUrl}`));
    console.log(chalk.green(`    Method: ${callMethod}`));
    if (callBody) {
        console.log(chalk.green(`    Body: ${callBody}`));
    }
    if (Object.keys(callHeaders).length > 0) {
        console.log(chalk.green(`    Headers: ${JSON.stringify(callHeaders)}`));
    }

    globals.addOpenapiOutput({
        url: callUrl || "",
        method: callMethod || "",
        path: callUrl || "",
        headers: callHeaders || {},
        body: callBody || "",
        chunkId: chunkName,
        functionFile: functionFile,
        functionFileLine: functionFileLine,
    });
};
