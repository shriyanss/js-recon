import makeRequest from "../../utility/makeReq.js";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import chalk from "chalk";
import next_getJSScript from "./next_GetJSScript.js";

const traverse = _traverse.default;

const next_parseLayoutJs = async (urls: string[]) => {
    console.log(chalk.cyan("[i] Parsing layout.js files"));

    let toReturn: string[] = [];

    // iterate through all the URLs and find the layout.*.js files

    for (const url of urls) {
        if (url.includes("layout-")) {
            // request the content, and parse it
            const req = await makeRequest(url);

            const jsContent = await req.text();
            let ast;

            try {
                ast = parser.parse(jsContent, {
                    sourceType: "unambiguous",
                    plugins: ["jsx", "typescript"],
                    errorRecovery: true,
                });
            } catch { continue }

            let hrefFinds: string[] = [];

            const resolveString = (node: any): string => {
                if (!node) return "";

                if (node.type === "StringLiteral") {
                    return node.value;
                }

                if (node.type === "TemplateLiteral") {
                    let str = "";
                    node.quasis.forEach((q: any, i: number) => {
                        str += q.value.raw;
                        if (i < node.expressions.length) {
                            str += resolveString(node.expressions[i]);
                        }
                    });
                    return str;
                }

                if (node.type === "BinaryExpression" && node.operator === "+") {
                    return resolveString(node.left) + resolveString(node.right);
                }

                if (node.type === "CallExpression") {
                    if (node.callee.type === "MemberExpression" && node.callee.property.name === "concat") {
                        let base = resolveString(node.callee.object);
                        node.arguments.forEach((arg: any) => {
                            base += resolveString(arg);
                        });
                        return base;
                    }
                }

                // If it's an identifier or unknown, we return a placeholder to represent dynamic content
                return Math.random()
                    .toString(36)
                    .substring(2, 2 + 64);
            };

            // traverse through the AST, and find all the hrefs
            traverse(ast, {
                ObjectProperty(path: any) {
                    const { key, value } = path.node;
                    // Check if key is 'href' (identifier) or "href" (literal)
                    if (key.name === "href") {
                        const resolved = resolveString(value);
                        if (resolved) {
                            hrefFinds.push(resolved);
                        }
                    }
                },
            });

            // iterate through each href, and try to send the server a request
            // if the response code is 200, run all the methods again on that

            for (const href of hrefFinds) {
                const newUrl = new URL(href, new URL(url).origin).href;

                if (newUrl.startsWith("mailto:")) continue;

                let req: Response | null;
                try {
                    req = await makeRequest(newUrl);
                } catch { continue }

                if (req.status === 200) {
                    console.log(chalk.green("[✓] Found new client side URL: ", newUrl));
                    // parse the HTML for script tags
                    const jsFiles = await next_getJSScript(newUrl);
                    toReturn.push(...jsFiles);
                }
            }
        }
    }

    // dedupe
    toReturn = [...new Set(toReturn)];

    if (toReturn.length !== 0) {
        console.log(chalk.green(`[✓] Found ${toReturn.length} JS files from the layout.js files`));
    }
    return toReturn;
};

export default next_parseLayoutJs;
