import chalk from "chalk";
import { Chunks } from "../../utility/interfaces.js";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import { ArrowFunctionExpression, FunctionDeclaration } from "@babel/types";
const traverse = _traverse.default;

const getExports = (chunks: Chunks) => {
    console.log(chalk.cyan("[i] Getting exports"));

    // iterate through the chunks
    for (const chunk of Object.values(chunks)) {
        // get the chunk code
        const chunkCode = chunk.code;
        console.log(chunk.id);

        // parse it with ast
        const ast = parser.parse(chunkCode, {
            sourceType: "unambiguous",
            plugins: ["jsx", "typescript"],
            errorRecovery: true,
        });

        // declare the exportname var
        let secondArg: string;
        let thirdArg: string;

        // get the second and the third argument of the function
        traverse(ast, {
            enter(path) {
                let funcNode: FunctionDeclaration | ArrowFunctionExpression | null = null;
                if (path.isFunctionDeclaration()) {
                    funcNode = path.node;
                } else if (path.isAssignmentExpression() && path.node.right.type === "ArrowFunctionExpression") {
                    funcNode = path.node.right;
                }

                if (funcNode && funcNode.params.length === 2) {
                    const secondParam = funcNode.params[1];
                    if (secondParam.type === "Identifier") {
                        secondArg = secondParam.name;
                        if (secondArg && thirdArg) {
                            path.stop();
                        }
                    }
                }

                if (funcNode && funcNode.params.length === 3) {
                    const thirdParam = funcNode.params[2];
                    if (thirdParam.type === "Identifier") {
                        thirdArg = thirdParam.name;
                        if (secondArg && thirdArg) {
                            path.stop();
                        }
                    }
                }
            },
        });

        if (!secondArg) {
            continue;
        }

        // first of all, it is exported something like this:
        // thirsArg.<something>(secondArg, {default: ..., key2: ...})
        // we need to get the names like 'default', 'key2', etc

        traverse(ast, {
            enter(path) {},
        });
    }
};

export default getExports;
