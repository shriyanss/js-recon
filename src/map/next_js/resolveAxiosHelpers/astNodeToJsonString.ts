import { Node } from "@babel/types";

export const astNodeToJsonString = (node: Node, code: string): string => {
    if (!node) {
        return '""';
    }

    switch (node.type) {
        case "ObjectExpression": {
            const props = node.properties
                .map((prop) => {
                    if (prop.type === "ObjectProperty") {
                        const key = astNodeToJsonString(prop.key, code);
                        const value = astNodeToJsonString(prop.value, code);
                        return `${key}: ${value}`;
                    } else if (prop.type === "SpreadElement") {
                        // Handle spread elements by trying to resolve them, or returning a placeholder
                        return `"...${astNodeToJsonString(prop.argument, code)}"`;
                    }
                    return null; // Or handle other property types if necessary
                })
                .filter(Boolean);
            return `{${props.join(", ")}}`;
        }
        case "ArrayExpression": {
            const elements = node.elements.map((elem) => astNodeToJsonString(elem, code));
            return `[${elements.join(", ")}]`;
        }
        case "StringLiteral": {
            return JSON.stringify(node.value);
        }
        case "NumericLiteral": {
            return String(node.value);
        }
        case "BooleanLiteral": {
            return String(node.value);
        }
        case "NullLiteral": {
            return "null";
        }
        case "Identifier": {
            return `"${node.name}"`;
        }
        case "MemberExpression": {
            // Reconstruct the member expression as a string, removing newlines
            return `"${code.slice(node.start, node.end).replace(/\n\s*/g, " ")}"`;
        }
        default: {
            // For any other node types, slice the original code, remove newlines, and wrap in quotes
            return `"${code.slice(node.start, node.end).replace(/\n\s*/g, " ")}"`;
        }
    }
};
