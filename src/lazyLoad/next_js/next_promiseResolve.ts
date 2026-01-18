import chalk from "chalk";
import makeRequest from "../../utility/makeReq.js";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import resolvePath from "../../utility/resolvePath.js";
const traverse = _traverse.default;

const next_promiseResolve = async (urls: string[]) => {
    console.log(chalk.cyan("[i] Check for Promise.all pattern"));

    let toReturn: string[] = [];

    // go through all the URLs, and find which which one has `static/chunks/` in it
    let jsDirBase: string | null = null;
    for (const url of urls) {
        if (url.includes("static/chunks/")) {
            jsDirBase = url.split("/").slice(0, -1).join("/");
            break;
        }
    }

    for (const url of urls) {
        // get the contents of the file
        const req = await makeRequest(url);
        if (!req || !req.ok) continue;

        const data = await req.text();

        try {
            const ast = parser.parse(data, {
                sourceType: "unambiguous",
                plugins: ["jsx", "typescript"],
                errorRecovery: true,
            });

            let matches: string[] = [];
            traverse(ast, {
                CallExpression(path) {
                    const { node } = path;

                    // Check for Promise.all([...].map(...)) pattern
                    if (
                        node.callee.type === "MemberExpression" &&
                        node.callee.object.type === "Identifier" &&
                        node.callee.object.name === "Promise" &&
                        node.callee.property.type === "Identifier" &&
                        node.callee.property.name === "all"
                    ) {
                        const arg = node.arguments[0];
                        if (
                            arg &&
                            arg.type === "CallExpression" &&
                            arg.callee.type === "MemberExpression" &&
                            arg.callee.property.type === "Identifier" &&
                            arg.callee.property.name === "map" &&
                            arg.callee.object.type === "ArrayExpression"
                        ) {
                            arg.callee.object.elements.forEach((element) => {
                                if (element && element.type === "StringLiteral") {
                                    matches.push(element.value);
                                }
                            });
                        }
                    }
                },
            });

            // now that we got the match, we can use it to build the final URL
            for (const match of matches) {
                const jsFileName = match.replace("static/chunks/", "/");
                const jsFileUrl = jsDirBase + jsFileName;

                toReturn.push(jsFileUrl);
            }
        } catch (e) {}
    }

    return toReturn;
};

export default next_promiseResolve;
