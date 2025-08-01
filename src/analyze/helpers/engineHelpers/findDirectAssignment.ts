import _traverse from "@babel/traverse";
import { Node } from "@babel/types";

const traverse = _traverse.default;

export function findDirectAssignment(nodeToFind: Node, scope: Node): Node | null {
    let assignmentNode: Node | null = null;

    traverse(scope, {
        AssignmentExpression(path) {
            // Check if the left-hand side of the assignment matches the nodeToFind
            if (path.node.left.type === 'Identifier' && nodeToFind.type === 'Identifier' && path.node.left.name === nodeToFind.name) {
                assignmentNode = path.node;
                path.stop(); // Stop traversal once found
            }
        },
        VariableDeclarator(path) {
            // Check if the variable being declared matches the nodeToFind
            if (path.node.id.type === 'Identifier' && nodeToFind.type === 'Identifier' && path.node.id.name === nodeToFind.name) {
                assignmentNode = path.node;
                path.stop(); // Stop traversal once found
            }
        }
    });

    return assignmentNode;
}
