import { Node } from "@babel/types";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;

/**
 * Finds an assignment expression where the left side is a member expression with a property that matches the given name.
 * Traverses the given node and its children to find a match.
 * @param node The AST node to traverse.
 * @param toMatch The name of the property to match on the left side of the assignment.
 * @param scope The scope of the traverse.
 * @returns The assignment expression node if found, otherwise undefined.
 */
export const findMemberExpressionAssignment = (node: Node, toMatch: string, scope: Node): Node | undefined => {
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
