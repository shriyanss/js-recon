import fs from "fs";
import path from "path";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import chalk from "chalk";
const traverse = _traverse.default;

const client_jsFilesHref = async (directory) => {
    console.log(chalk.cyan("[i] Searching for `href` in the JS chunks"));
    let discoveredPaths = [];
    // index all the files in the directory
    let files;
    files = fs.readdirSync(directory, { recursive: true });

    // filter out the directories
    files = files.filter(
        (file) => !fs.statSync(path.join(directory, file)).isDirectory()
    );

    // filter out the subsequent requests files
    files = files.filter((file) => !file.startsWith("___subsequent_requests"));

    for (const file of files) {
        const code = fs.readFileSync(path.join(directory, file), "utf8");

        // parse the code with ast
        let ast;
        try {
            ast = parser.parse(code, {
                sourceType: "unambiguous",
                plugins: ["jsx", "typescript"],
                errorRecovery: true,
            });

            traverse(ast, {
                ObjectProperty(path) {
                    const keyNode = path.node.key;
                    let keyName;
                    if (keyNode.type === "Identifier") {
                        keyName = keyNode.name;
                    } else if (keyNode.type === "StringLiteral") {
                        keyName = keyNode.value;
                    }

                    if (keyName !== "href") {
                        return;
                    }

                    const valueNode = path.node.value;
                    let hrefValue = null;

                    if (valueNode.type === "StringLiteral") {
                        hrefValue = valueNode.value;
                    } else if (
                        valueNode.type === "CallExpression" &&
                        valueNode.callee.type === "MemberExpression" &&
                        valueNode.callee.property.name === "concat"
                    ) {
                        // It's a .concat() call.
                        // Let's find string literal arguments that look like paths.
                        const pathArg = valueNode.arguments.find(
                            (arg) =>
                                arg.type === "StringLiteral" &&
                                (arg.value.startsWith("/") ||
                                    arg.value.startsWith("http"))
                        );

                        if (pathArg) {
                            hrefValue = pathArg.value;
                        } else {
                            // Handle fallback case: e.g. "".concat(s || "/docs/guides")
                            const logicalExprArg = valueNode.arguments.find(
                                (arg) =>
                                    arg.type === "LogicalExpression" &&
                                    arg.operator === "||"
                            );
                            if (
                                logicalExprArg &&
                                logicalExprArg.right.type === "StringLiteral"
                            ) {
                                hrefValue = logicalExprArg.right.value;
                            }
                        }
                    }

                    if (hrefValue) {
                        const isPath =
                            hrefValue.startsWith("/") ||
                            hrefValue.startsWith("http");
                        if (isPath && !discoveredPaths.includes(hrefValue)) {
                            discoveredPaths.push(hrefValue);
                        }
                    }
                },
            });
        } catch (err) {
            continue;
        }
    }

    return discoveredPaths;
};

export default client_jsFilesHref;
