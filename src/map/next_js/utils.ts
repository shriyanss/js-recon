import { Node } from "@babel/types";
import parser from "@babel/parser";
import { Scope } from "@babel/traverse";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;

/**
 * Resolves AST node values to their actual runtime values for fetch and axios calls.
 *
 * This function performs deep resolution of JavaScript AST nodes, handling:
 * - String literals, template literals, and concatenation
 * - Object expressions and member access
 * - Variable bindings and identifier resolution
 * - Call expressions including JSON.stringify
 * - Logical and conditional expressions
 * - Binary expressions and arithmetic operations
 *
 * @param initialNode - The AST node to resolve
 * @param scope - The Babel scope for variable resolution
 * @param nodeCode - The source code string for the node
 * @param callType - Whether this is for 'fetch' or 'axios' call analysis
 * @returns The resolved value or a descriptive placeholder string
 */
export const resolveNodeValue = (
    initialNode: Node,
    scope: Scope,
    nodeCode: string,
    callType: "fetch" | "axios"
): any => {
    let currentNode: Node | null = initialNode;
    const visited = new Set<Node>();

    try {
        while (currentNode) {
            if (visited.has(currentNode)) {
                return "[cyclic reference]";
            }
            visited.add(currentNode);

            if (!currentNode) return null;

            // fetch specific ops
            if (callType === "fetch") {
                // check if it is a JSON.stringify call
                if (currentNode.type === "CallExpression" && currentNode.callee.type === "MemberExpression") {
                    if (
                        currentNode.callee.property.type === "Identifier" &&
                        currentNode.callee.property.name === "stringify"
                    ) {
                        // if so, then first get the args for it
                        const args = currentNode.arguments;

                        // see if the first arg is an object
                        if (args.length > 0 && args[0].type === "ObjectExpression") {
                            // if it is an object, then convert stringify it
                            const obj: { [key: string]: any } = {};
                            for (const prop of args[0].properties) {
                                if (prop.type === "ObjectProperty" && prop.key.type === "Identifier") {
                                    const key = prop.key.name;
                                    if (prop.value.type === "Identifier") {
                                        obj[key] = prop.value.name;
                                    } else if (
                                        prop.value.type === "CallExpression" &&
                                        prop.value.callee.type === "MemberExpression" &&
                                        prop.value.callee.property.type === "Identifier" &&
                                        prop.value.callee.property.name === "stringify"
                                    ) {
                                        obj[key] = "[call to object...]";
                                    } else {
                                        // For other types of values, you might want to add more handling
                                        // For now, we'll just represent them as a string of their type.
                                        obj[key] = `[${prop.value.type}]`;
                                    }
                                } else if (prop.type === "SpreadElement") {
                                    // Handle spread elements if necessary, e.g., by adding a placeholder
                                    obj["...spread"] = `[${prop.argument.type}]`;
                                }
                            }
                            return obj;
                        }
                    }
                }
            }

            switch (currentNode.type) {
                case "StringLiteral":
                case "NumericLiteral":
                case "BooleanLiteral":
                    return currentNode.value;
                case "NullLiteral":
                    return null;
                case "TemplateLiteral": {
                    let result = "";
                    for (let i = 0; i < currentNode.quasis.length; i++) {
                        result += currentNode.quasis[i].value.raw;
                        if (i < currentNode.expressions.length) {
                            const resolved = resolveNodeValue(currentNode.expressions[i], scope, nodeCode, callType);
                            if (resolved === "[call_stack_exceeded_use_better_machine]") {
                                return resolved;
                            }
                            result += resolved;
                        }
                    }
                    return result;
                }
                case "Identifier": {
                    const binding = scope.getBinding(currentNode.name);
                    if (binding && binding.path.node.init) {
                        currentNode = binding.path.node.init;
                        continue;
                    }
                    return `[unresolved: ${currentNode.name}]`;
                }
                case "ObjectExpression": {
                    const obj = {};
                    for (const prop of currentNode.properties) {
                        if (prop.type === "ObjectProperty") {
                            let key;
                            if (prop.computed) {
                                const resolved = resolveNodeValue(prop.key, scope, nodeCode, callType);
                                if (resolved === "[call_stack_exceeded_use_better_machine]") {
                                    return resolved;
                                }
                                key = resolved;
                            } else if (prop.key.type === "Identifier") {
                                key = prop.key.name;
                            } else if (prop.key.type === "StringLiteral") {
                                key = prop.key.value;
                            }
                            const value = resolveNodeValue(prop.value, scope, nodeCode, callType);
                            if (value === "[call_stack_exceeded_use_better_machine]") {
                                return value;
                            }
                            obj[key] = value;
                        } else if (prop.type === "SpreadElement") {
                            const resolved = resolveNodeValue(prop.argument, scope, nodeCode, callType);
                            if (resolved === "[call_stack_exceeded_use_better_machine]") {
                                return resolved;
                            }
                            const spreadObj = resolved;
                            if (typeof spreadObj === "object" && spreadObj !== null) {
                                Object.assign(obj, spreadObj);
                            }
                        }
                    }
                    return obj;
                }
                case "MemberExpression": {
                    const object = resolveNodeValue(currentNode.object, scope, nodeCode, callType);
                    if (object === "[call_stack_exceeded_use_better_machine]") {
                        return object;
                    }
                    if (typeof object === "object" && object !== null) {
                        let propertyName;
                        if (currentNode.computed) {
                            const resolved = resolveNodeValue(currentNode.property, scope, nodeCode, callType);
                            if (resolved === "[call_stack_exceeded_use_better_machine]") {
                                return resolved;
                            }
                            propertyName = resolved;
                        } else if (currentNode.property.type === "Identifier") {
                            propertyName = currentNode.property.name;
                        }
                        return object[propertyName];
                    }
                    return `[unresolved member expression]`;
                }
                case "CallExpression": {
                    if (
                        currentNode.callee.type === "MemberExpression" &&
                        currentNode.callee.property.type === "Identifier" &&
                        currentNode.callee.property.name === "toString"
                    ) {
                        currentNode = currentNode.callee.object;
                        continue;
                    }
                    let calleeName = "[unknown]";
                    if (currentNode.callee.type === "Identifier") {
                        calleeName = currentNode.callee.name;
                    }

                    // a lot of times, things like `"".concat(var1).concat(var2)` - which is basically multiple
                    // .concat() with varying arguments end up here. They needs to be resolved as a string

                    // first, match as regex
                    if (nodeCode.replace(/\n\s*/g, "").match(/^"[\d\w\/]*"(\.concat\(.+\))+$/)) {
                        // parse it separately with ast
                        const ast = parser.parse(nodeCode, {
                            sourceType: "unambiguous",
                            plugins: ["jsx", "typescript"],
                            errorRecovery: true,
                        });

                        // get all the concat calls first. Like .concat(...)
                        // I want to only get concat() and nothing else. Also, it doesn't matter how many times they are called
                        const concatCalls: any[][] = [];

                        const getArgValue = (arg: Node): any => {
                            switch (arg.type) {
                                case "StringLiteral":
                                case "NumericLiteral":
                                case "BooleanLiteral":
                                    return arg.value;
                                case "NullLiteral":
                                    return null;
                                case "Identifier":
                                    return `[var ${arg.name}]`; // Format identifiers as [var name]
                                default:
                                    // @ts-ignore
                                    return `[${arg.type} -> ${arg.type === "MemberExpression" ? arg.property?.name : ""}]`;
                            }
                        };

                        traverse(ast, {
                            CallExpression(path) {
                                // We only want to start from the outermost `concat` call.
                                if (
                                    path.node.callee.type !== "MemberExpression" ||
                                    path.node.callee.property.type !== "Identifier" ||
                                    path.node.callee.property.name !== "concat" ||
                                    path.parent.type === "MemberExpression"
                                ) {
                                    return;
                                }

                                let current = path.node;
                                while (
                                    current &&
                                    current.type === "CallExpression" &&
                                    current.callee.type === "MemberExpression"
                                ) {
                                    const args = current.arguments.map(getArgValue);
                                    concatCalls.unshift(args);
                                    current = current.callee.object;
                                }

                                if (current) {
                                    if (current.type === "StringLiteral") {
                                        concatCalls.unshift([current.value]);
                                    } else if (current.type === "Identifier") {
                                        concatCalls.unshift([`[var ${current.name}]`]);
                                    } else {
                                        concatCalls.unshift([
                                            `[${current.type} -> ${
                                                current.type === "MemberExpression" ? current.property?.name : ""
                                            }]`,
                                        ]);
                                    }
                                }

                                // Stop traversal once we've processed the chain.
                                path.stop();
                            },
                        });

                        // process the concatCalls to return a single string
                        if (concatCalls.length > 0) {
                            const toReturn = concatCalls.flat().join("");
                            return toReturn;
                        }
                    }

                    return `[unresolved call to ${calleeName || "function"} -> ${nodeCode?.replace(/\n\s*/g, "")}]`;
                }
                case "NewExpression": {
                    if (
                        currentNode.callee.type === "Identifier" &&
                        currentNode.callee.name === "URL" &&
                        currentNode.arguments.length > 0
                    ) {
                        currentNode = currentNode.arguments[0];
                        continue;
                    }
                    return `[unresolved new expression]`;
                }
                case "LogicalExpression": {
                    const left = resolveNodeValue(currentNode.left, scope, nodeCode, callType);
                    if (left === "[call_stack_exceeded_use_better_machine]") {
                        return left;
                    } else if (left && !String(left).startsWith("[")) {
                        return left;
                    }
                    currentNode = currentNode.right;
                    continue;
                }
                case "ConditionalExpression": {
                    const consequent = resolveNodeValue(currentNode.consequent, scope, nodeCode, callType);
                    if (consequent === "[call_stack_exceeded_use_better_machine]") {
                        return consequent;
                    } else if (consequent && !String(consequent).startsWith("[")) {
                        return consequent;
                    }
                    currentNode = currentNode.alternate;
                    continue;
                }
                case "BinaryExpression": {
                    const left = resolveNodeValue(currentNode.left, scope, nodeCode, callType);
                    if (left === "[call_stack_exceeded_use_better_machine]") {
                        return left;
                    }
                    const right = resolveNodeValue(currentNode.right, scope, nodeCode, callType);
                    if (right === "[call_stack_exceeded_use_better_machine]") {
                        return right;
                    }
                    if (
                        left !== null &&
                        right !== null &&
                        !String(left).startsWith("[") &&
                        !String(right).startsWith("[")
                    ) {
                        // eslint-disable-next-line default-case
                        switch (currentNode.operator) {
                            case "+":
                                return left + right;
                        }
                    }
                    return `[unresolved binary expression: ${currentNode.operator}]`;
                }
                default:
                    return `[unsupported node type: ${currentNode.type}]`;
            }
        }
        return null;
    } catch (e) {
        // check if it's a "Maximum call stack size exceeded" error
        if (e instanceof RangeError && e.message.includes("Maximum call stack size exceeded")) {
            return "[call_stack_exceeded_use_better_machine]";
            // console.error("[error] Maximum call stack size exceeded. Please use a better machine.");
            // process.exit(21);
        }
    }
};

/**
 * Resolves string concatenation operations to flatten concat chains.
 *
 * Handles patterns like '"/api/teams/".concat(i, "/members")' by:
 * - Parsing the string literal and concat arguments
 * - Replacing variables with placeholder strings like '[var name]'
 * - Flattening the entire concatenation chain into a single string
 * - Respecting quoted strings and handling nested expressions
 *
 * @param rawExpr - The raw expression string containing concat operations
 * @returns Flattened string with variable placeholders
 */
export const resolveStringOps = (rawExpr: string): string => {
    if (!rawExpr || typeof rawExpr !== "string") return rawExpr;

    // Quick check for pattern "<string literal>.concat(... )"
    const concatMatch = rawExpr.match(/^(\s*["'`])(.*?)(\1)\.concat\(([\s\S]*)\)$/);
    if (!concatMatch) {
        // Not in expected pattern – return as-is for now.
        return rawExpr;
    }

    const leadingLiteral = concatMatch[2];
    const argsPart = concatMatch[4]; // everything inside the concat(...)

    // Split arguments respecting quotes. We'll do a naive split on commas that are not inside quotes.
    const args: string[] = [];
    let current = "";
    let inSingle = false;
    let inDouble = false;
    let inBacktick = false;

    for (let i = 0; i < argsPart.length; i++) {
        const ch = argsPart[i];
        if (ch === "'" && !inDouble && !inBacktick) {
            inSingle = !inSingle;
            current += ch;
            continue;
        }
        if (ch === '"' && !inSingle && !inBacktick) {
            inDouble = !inDouble;
            current += ch;
            continue;
        }
        if (ch === "`" && !inSingle && !inDouble) {
            inBacktick = !inBacktick;
            current += ch;
            continue;
        }
        if (ch === "," && !inSingle && !inDouble && !inBacktick) {
            args.push(current.trim());
            current = "";
            continue;
        }
        current += ch;
    }
    if (current.trim() !== "") args.push(current.trim());

    // Build resolved string
    let result = leadingLiteral;
    for (const arg of args) {
        const trimmed = arg.trim();
        if (/^['"`].*['"`]$/.test(trimmed)) {
            // string literal – strip quotes
            result += trimmed.slice(1, -1);
        } else if (trimmed.length) {
            // treat as identifier / expression – replace with placeholder
            // attempt to extract simple identifier name if possible
            const idMatch = trimmed.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
            const idName = idMatch ? idMatch[0] : trimmed;
            result += `[var ${idName}]`;
        }
    }

    return result;
};
