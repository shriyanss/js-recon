import { NodePath } from "@babel/traverse";
import { MemberExpression, Node } from "@babel/types";
import { Chunks } from "../../../utility/interfaces.js";
import * as fs from "fs";
import chalk from "chalk";
import { resolveNodeValue, resolveStringOps } from "../utils.js";
import { astNodeToJsonString } from "./astNodeToJsonString.js";
import * as globals from "../../../utility/globals.js";
import globalConfig from "../../../globalConfig.js";
import { handleAxiosCreate } from "./handleAxiosCreate.js";

const getHttpMethod = (methodName: string): string | null => {
    const upperCaseMethod = methodName.toUpperCase();
    const httpMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS", "TRACE", "CONNECT"];
    if (httpMethods.includes(upperCaseMethod)) {
        return upperCaseMethod;
    }
    return null;
};

export const processAxiosCall = (
    path: NodePath<MemberExpression>,
    axiosInstance: string,
    chunkCode: string,
    directory: string,
    chunkName: string,
    chunks: Chunks,
    ast: any
) => {
    if (
        path.node.object.type !== "MemberExpression" ||
        path.node.object.object.type !== "Identifier" ||
        path.node.object.object.name !== axiosInstance
    ) {
        return;
    }

    const codeSnippet = chunkCode.split("\n")[path.node.loc.start.line - 1];
    const secondProp = path.node.property.type === "Identifier" ? path.node.property.name : "";

    if (secondProp === "create") {
        if (handleAxiosCreate(path, ast, chunkCode, directory, chunkName, chunks)) {
            path.skip(); // Skip further traversal if it was an axios.create() call
        }
        return;
    }

    const callMethod = getHttpMethod(secondProp);
    if (!callMethod) {
        if (!globalConfig.axiosNonHttpMethods.includes(secondProp)) {
            // console.log(chalk.yellow(`[!] Unknown or unhandled axios method: ${secondProp}`));
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
            } else if (axiosFirstArg.type === "StringLiteral") {
                callUrl = axiosFirstArg.value;
            } else {
                callUrl = resolveNodeValue(axiosFirstArg, path.scope, axiosFirstArgText, "axios");
            }
        }

        if (args.length > 1) {
            const axiosSecondArg = args[1];
            if (axiosSecondArg.type === "ObjectExpression") {
                const headersProp = axiosSecondArg.properties.find(
                    (p) => p.type === "ObjectProperty" && p.key.type === "Identifier" && p.key.name === "headers"
                );
                const dataProp = axiosSecondArg.properties.find(
                    (p) => p.type === "ObjectProperty" && p.key.type === "Identifier" && p.key.name === "data"
                );

                if (headersProp && headersProp.type === "ObjectProperty" && headersProp.value.type === "ObjectExpression") {
                    const newHeaders = {};
                    for (const header of headersProp.value.properties) {
                        if (header.type === "ObjectProperty") {
                            let key: string;
                            if (header.key.type === "Identifier") {
                                key = header.key.name;
                            } else if (header.key.type === "StringLiteral") {
                                key = header.key.value;
                            } else {
                                key = `[unresolved key]`
                            }
                            const value = astNodeToJsonString(header.value, chunkCode);
                            newHeaders[key] = value;
                        }
                    }
                    callHeaders = newHeaders;
                }

                if (dataProp && dataProp.type === "ObjectProperty") {
                    callBody = astNodeToJsonString(dataProp.value, chunkCode);
                } else if (!dataProp) {
                    const otherProps = axiosSecondArg.properties.filter(
                        (p) =>
                            !(p.type === "ObjectProperty" && p.key.type === "Identifier" && p.key.name === "headers")
                    );
                    if (otherProps.length > 0) {
                        const bodyObject = { ...axiosSecondArg, properties: otherProps };
                        callBody = astNodeToJsonString(bodyObject, chunkCode);
                    }
                }
            } else {
                callBody = astNodeToJsonString(axiosSecondArg, chunkCode);
            }
        }
    }

    const functionFile = `${directory}/${chunks[chunkName].file}`;
    const codeFileContent = fs.readFileSync(functionFile, "utf-8");
    let functionFileLine = -1;
    const lines = codeFileContent.split("\n");
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(codeSnippet.trim())) {
            functionFileLine = i + 1;
            break;
        }
    }

    console.log(chalk.blue(`[+] Found axios call in chunk ${chunkName} ("${functionFile}":${functionFileLine})`));
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
