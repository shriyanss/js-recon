import chalk from "chalk";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import fs from "fs";
import path from "path";
import { Chunks } from "../../utility/interfaces.js";
const traverse = _traverse.default;

const resolveNodeValue = (node, scope) => {
    if (!node) return null;

    switch (node.type) {
        case "StringLiteral":
        case "NumericLiteral":
        case "BooleanLiteral":
            return node.value;
        case "NullLiteral":
            return null;
        case "TemplateLiteral":
            let result = "";
            for (let i = 0; i < node.quasis.length; i++) {
                result += node.quasis[i].value.raw;
                if (i < node.expressions.length) {
                    result += resolveNodeValue(node.expressions[i], scope);
                }
            }
            return result;
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
                    const key = prop.computed
                        ? resolveNodeValue(prop.key, scope)
                        : prop.key.name || prop.key.value;
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
                const propertyName = node.computed
                    ? resolveNodeValue(node.property, scope)
                    : node.property.name;
                return object[propertyName];
            }
            return `[unresolved member expression]`;
        }
        case "CallExpression": {
            if (
                node.callee.type === "MemberExpression" &&
                node.callee.property.name === "toString"
            ) {
                return resolveNodeValue(node.callee.object, scope);
            }
            return `[unresolved call to ${node.callee.name || "function"}]`;
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

const resolveFetch = async (chunks: Chunks, directory: string, formats) => {
    console.log(chalk.cyan("[i] Resolving fetch instances"));

    for (const chunk of Object.values(chunks)) {
        if (!chunk.containsFetch || !chunk.file) {
            continue;
        }

        const filePath = path.join(directory, chunk.file);
        let fileContent;

        try {
            fileContent = fs.readFileSync(filePath, "utf-8");
        } catch (error) {
            console.log(chalk.red(`[!] Could not read file: ${filePath}`));
            continue;
        }

        let fileAst;
        try {
            fileAst = parser.parse(fileContent, {
                sourceType: "module",
                plugins: ["jsx", "typescript"],
                errorRecovery: true,
            });
        } catch (err) {
            console.log(
                chalk.red(
                    `[!] Failed to parse file: ${filePath}. Error: ${err.message}`
                )
            );
            continue;
        }

        const fetchAliases = new Set();

        // Pass 1: Find fetch aliases on the full file AST
        traverse(fileAst, {
            VariableDeclarator(path) {
                if (path.node.id.type === "Identifier" && path.node.init) {
                    if (
                        path.node.init.type === "Identifier" &&
                        path.node.init.name === "fetch"
                    ) {
                        const binding = path.scope.getBinding(
                            path.node.id.name
                        );
                        if (binding) fetchAliases.add(binding);
                    }
                }
            },
        });

        // Pass 2: Find and resolve fetch calls on the full file AST
        traverse(fileAst, {
            CallExpression(path) {
                let isFetchCall = false;
                const calleeName = path.node.callee.name;

                if (calleeName === "fetch") {
                    isFetchCall = true;
                } else {
                    const binding = path.scope.getBinding(calleeName);
                    if (binding && fetchAliases.has(binding)) {
                        isFetchCall = true;
                    }
                }

                if (isFetchCall) {
                    console.log(
                        chalk.blue(
                            `[+] Found fetch call in chunk ${chunk.id} (${chunk.file}) at L${
                                path.node.loc.start.line
                            }`
                        )
                    );
                    const args = path.node.arguments;
                    if (args.length > 0) {
                        const url = resolveNodeValue(args[0], path.scope);
                        console.log(chalk.green(`    URL: ${url}`));

                        if (args.length > 1) {
                            const options = resolveNodeValue(
                                args[1],
                                path.scope
                            );
                            if (
                                typeof options === "object" &&
                                options !== null
                            ) {
                                console.log(
                                    chalk.green(
                                        `    Method: ${options.method || "GET"}`
                                    )
                                );
                                if (options.headers)
                                    console.log(
                                        chalk.green(
                                            `    Headers: ${JSON.stringify(options.headers)}`
                                        )
                                    );
                                if (options.body)
                                    console.log(
                                        chalk.green(
                                            `    Body: ${JSON.stringify(options.body)}`
                                        )
                                    );
                            } else {
                                console.log(
                                    chalk.yellow(`    Options: ${options}`)
                                );
                            }
                        }
                    }
                }
            },
        });
    }
};

export default resolveFetch;
