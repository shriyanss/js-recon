import { Node } from "@babel/types";
import { Scope } from "@babel/traverse";

export const resolveNodeValue = (node: Node, scope: Scope): any => {
    if (!node) return null;

    switch (node.type) {
        case "StringLiteral":
        case "NumericLiteral":
        case "BooleanLiteral":
            return node.value;
        case "NullLiteral":
            return null;
        case "TemplateLiteral": {
            let result = "";
            for (let i = 0; i < node.quasis.length; i++) {
                result += node.quasis[i].value.raw;
                if (i < node.expressions.length) {
                    result += resolveNodeValue(node.expressions[i], scope);
                }
            }
            return result;
        }
        case "Identifier": {
            const binding = scope.getBinding(node.name);
            if (binding && binding.path.node.init) {
                return resolveNodeValue(binding.path.node.init, scope);
            }
            return `[unresolved: ${node.name}]`;
        }
        case "ObjectExpression": {
            const obj = {};
            for (const prop of node.properties) {
                if (prop.type === "ObjectProperty") {
                    let key;
                    if (prop.computed) {
                        key = resolveNodeValue(prop.key, scope);
                    } else if (prop.key.type === "Identifier") {
                        key = prop.key.name;
                    } else if (prop.key.type === "StringLiteral") {
                        key = prop.key.value;
                    }
                    const value = resolveNodeValue(prop.value, scope);
                    obj[key] = value;
                } else if (prop.type === "SpreadElement") {
                    const spreadObj = resolveNodeValue(prop.argument, scope);
                    if (typeof spreadObj === "object" && spreadObj !== null) {
                        Object.assign(obj, spreadObj);
                    }
                }
            }
            return obj;
        }
        case "MemberExpression": {
            const object = resolveNodeValue(node.object, scope);
            if (typeof object === "object" && object !== null) {
                let propertyName;
                if (node.computed) {
                    propertyName = resolveNodeValue(node.property, scope);
                } else if (node.property.type === "Identifier") {
                    propertyName = node.property.name;
                }
                return object[propertyName];
            }
            return `[unresolved member expression]`;
        }
        case "CallExpression": {
            if (
                node.callee.type === "MemberExpression" &&
                node.callee.property.type === "Identifier" &&
                node.callee.property.name === "toString"
            ) {
                return resolveNodeValue(node.callee.object, scope);
            }
            let calleeName = "[unknown]";
            if (node.callee.type === "Identifier") {
                calleeName = node.callee.name;
            }
            return `[unresolved call to ${calleeName || "function"}]`;
        }
        case "NewExpression": {
            if (
                node.callee.type === "Identifier" &&
                node.callee.name === "URL" &&
                node.arguments.length > 0
            ) {
                return resolveNodeValue(node.arguments[0], scope);
            }
            return `[unresolved new expression]`;
        }
        case "LogicalExpression": {
            const left = resolveNodeValue(node.left, scope);
            if (left && !String(left).startsWith("[")) {
                return left;
            }
            return resolveNodeValue(node.right, scope);
        }
        case "ConditionalExpression": {
            const consequent = resolveNodeValue(node.consequent, scope);
            if (consequent && !String(consequent).startsWith("[")) {
                return consequent;
            }
            return resolveNodeValue(node.alternate, scope);
        }
        case "BinaryExpression": {
            const left = resolveNodeValue(node.left, scope);
            const right = resolveNodeValue(node.right, scope);
            if (
                left !== null &&
                right !== null &&
                !String(left).startsWith("[") &&
                !String(right).startsWith("[")
            ) {
                // eslint-disable-next-line default-case
                switch (node.operator) {
                    case "+":
                        return left + right;
                }
            }
            return `[unresolved binary expression: ${node.operator}]`;
        }
        default:
            return `[unsupported node type: ${node.type}]`;
    }
};
