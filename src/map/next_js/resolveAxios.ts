import chalk from "chalk";
import { Chunks } from "../../utility/interfaces.js";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import { findAxiosClients } from "./resolveAxiosHelpers/findAxiosClients.js";
import { findAxiosInstance } from "./resolveAxiosHelpers/findAxiosInstance.js";
import { processAxiosCall } from "./resolveAxiosHelpers/processAxiosCall.js";
import { ArrowFunctionExpression, FunctionDeclaration, Node } from "@babel/types";

const traverse = _traverse.default;

/**
 * Gets the third argument of a function declaration or arrow function expression.
 * @param {Node} ast - The abstract syntax tree of the function.
 * @returns {string} - The name of the third argument.
 */
const getThirdArg = (ast: Node): string => {
    let thirdArg = "";
    traverse(ast, {
        enter(path) {
            let funcNode: FunctionDeclaration | ArrowFunctionExpression | null = null;
            if (path.isFunctionDeclaration()) {
                funcNode = path.node;
            } else if (path.isAssignmentExpression() && path.node.right.type === "ArrowFunctionExpression") {
                funcNode = path.node.right;
            }

            if (funcNode && funcNode.params.length === 3) {
                const thirdParam = funcNode.params[2];
                if (thirdParam.type === "Identifier") {
                    thirdArg = thirdParam.name;
                    path.stop();
                }
            }
        },
    });
    return thirdArg;
};

/**
 * Resolves axios instances in the given chunks.
 * @param {Chunks} chunks - A dictionary of chunk names to chunk objects.
 * @param {string} directory - The directory of the chunk file.
 */
const resolveAxios = async (chunks: Chunks, directory: string) => {
    console.log(chalk.cyan("[i] Resolving axios instances"));

    const { axiosExportedTo, axiosImportedTo } = findAxiosClients(chunks);

    if (axiosExportedTo.length === 0) {
        console.log(chalk.yellow("[!] No axios clients defined in any chunk."));
        return;
    }

    if (Object.keys(axiosImportedTo).length === 0) {
        console.log(chalk.yellow("[!] No chunks import any of the defined axios clients."));
        return;
    }

    for (const chunkName of Object.keys(axiosImportedTo)) {
        const chunk = chunks[chunkName];
        const chunkCode = chunk.code;

        const ast = parser.parse(chunkCode, {
            sourceType: "unambiguous",
            plugins: ["jsx", "typescript"],
            errorRecovery: true,
        });

        const thirdArg = getThirdArg(ast);

        if (thirdArg) {
            const axiosInstance = findAxiosInstance(ast, thirdArg, axiosImportedTo[chunkName], chunkName);

            if (axiosInstance) {
                traverse(ast, {
                    MemberExpression(path) {
                        processAxiosCall(path, axiosInstance, chunkCode, directory, chunkName, chunks, ast);
                    },
                });
            } else {
                console.log(chalk.yellow(`[!] No axios instance found in ${chunkName}`));
            }
        } else {
            // This case might not be an error, just a different pattern.
            // console.log(chalk.yellow(`[!] Could not find a function with 3 arguments in ${chunkName}`));
        }
    }
};

export default resolveAxios;
