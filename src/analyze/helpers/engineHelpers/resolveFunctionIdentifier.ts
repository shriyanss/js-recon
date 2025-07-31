import { Node } from "@babel/types";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;

/**
 * Finds the declaration node for a given identifier node.
 * @param identifier The identifier node to resolve.
 * @param ast The root of the AST to search within.
 * @returns The declaration node if found, otherwise undefined.
 */
export function resolveFunctionIdentifier(
    identifier: Node,
    ast: Node
): Node | undefined {
    let declarationNode: Node | undefined;

    if (identifier.type !== "Identifier") {
        return undefined;
    }

    traverse(ast, {
        FunctionDeclaration(path) {
            if (path.node.id && path.node.id.name === identifier.name) {
                declarationNode = path.node;
                path.stop();
            }
        },
        VariableDeclarator(path) {
            if (
                path.node.id.type === "Identifier" &&
                path.node.id.name === identifier.name
            ) {
                if (
                    path.node.init &&
                    (path.node.init.type === "ArrowFunctionExpression" ||
                        path.node.init.type === "FunctionExpression")
                ) {
                    declarationNode = path.node.init;
                    path.stop();
                }
            }
        },
    });

    return declarationNode;
}
