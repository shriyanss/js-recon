import chalk from "chalk";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import _generator from "@babel/generator";
import * as t from "@babel/types";
import { Chunk } from "../../utility/interfaces.js";
const traverse = _traverse.default;
const generate = _generator.default;

const refactorNext = async (chunk: Chunk): Promise<string> => {
    console.log(chalk.cyan(`[i] Refactoring Next.js chunk: ${chunk.id}`));

    let codeCopy = chunk.code;

    // parse the code
    const ast = parser.parse(chunk.code, {
        sourceType: "unambiguous",
        plugins: ["jsx", "typescript"],
        errorRecovery: true,
    });

    // first of all, find the name of third argument of the function
    let thirdParamName: string;
    traverse(ast, {
        FunctionDeclaration(path) {
            if (path.node.params.length < 3) return;
            const thirdParam = path.node.params[2];
            if (thirdParam.type !== "Identifier") return;
            thirdParamName = thirdParam.name;
        },
        ArrowFunctionExpression(path) {
            if (path.node.params.length < 3) return;
            const thirdParam = path.node.params[2];
            if (thirdParam.type !== "Identifier") return;
            thirdParamName = thirdParam.name;
        },
    });

    // if third argument is there, then process further

    if (thirdParamName) {
        // now, I want to traverse through the code, and find the call expressions
        // it would be like thirdParamName(<some_number>)
        // I want to replace it with `require("./<some_number>.js")`
        // then, I want to write it in the codeCopy variable

        traverse(ast, {
            CallExpression(path) {
                if (
                    t.isIdentifier(path.node.callee, {
                        name: thirdParamName,
                    }) &&
                    path.node.arguments.length === 1 &&
                    t.isNumericLiteral(path.node.arguments[0])
                ) {
                    const argument = path.node.arguments[0];
                    const newRequire = t.callExpression(t.identifier("require"), [
                        t.stringLiteral(`./${argument.value}.js`),
                    ]);
                    path.replaceWith(newRequire);
                }
            },
        });

        codeCopy = generate(ast).code;
    }

    return codeCopy;
};

export default refactorNext;
