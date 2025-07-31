import { Node } from "@babel/types";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;

/**
 * Traverses a given AST node to find and log assignments between two member expressions.
 * @param node The AST node to traverse.
 * @param toMatch The name of the property to match on the left side of the assignment.
 */
export const findMemberExpressionAssignment = (
    node: Node,
    toMatch: string,
    scope: Node
): Node | undefined => {
    let foundNode: Node | undefined;

    traverse(
        node,
        {
            AssignmentExpression(path) {
                const assignmentNode = path.node;

                if (
                    assignmentNode.left?.type === "MemberExpression" &&
                    assignmentNode.right?.type === "MemberExpression" &&
                    (assignmentNode.left as any).property?.type === "Identifier" &&
                    (assignmentNode.left as any).property?.name === toMatch
                ) {
                    foundNode = assignmentNode;
                    // Stop further traversal once a match is found
                    path.stop();
                }
            },
        },
        scope
    );

    return foundNode;
};
