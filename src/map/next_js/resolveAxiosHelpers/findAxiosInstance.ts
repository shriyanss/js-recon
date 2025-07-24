import { Node } from "@babel/types";
import _traverse from "@babel/traverse";
import chalk from "chalk";
const traverse = _traverse.default;

export const findAxiosInstance = (ast: Node, thirdArg: string, axiosImportedToChunk: string, chunkName: string): string => {
    let axiosInstance = "";

    if (thirdArg !== "") {
        traverse(ast, {
            VariableDeclarator(path) {
                if (path.node.id.type === "Identifier") {
                    const varName = path.node.id.name;
                    const assignmentValue = path.node.init;
                    if (assignmentValue?.type === "CallExpression" && assignmentValue.callee.type === "Identifier" && assignmentValue.callee.name === thirdArg) {
                        const firstArg = assignmentValue.arguments[0];
                        if (firstArg && (firstArg.type === "StringLiteral" || firstArg.type === "NumericLiteral")) {
                            const thisFunctionAssignmentValue = firstArg.value.toString();
                            if (thisFunctionAssignmentValue === axiosImportedToChunk) {
                                console.log(
                                    chalk.green(`[✓] ${chunkName} uses axios client initialized in ${varName}`)
                                );
                                axiosInstance = varName;
                                path.stop();
                            }
                        }
                    }
                }
            },
        });
    }

    return axiosInstance;
};
