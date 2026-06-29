import makeRequest from "../../utility/makeReq.js";
import chalk from "chalk";
import _traverse from "@babel/traverse";
import parser from "@babel/parser";
import execFunc from "../../utility/runSandboxed.js";

const traverse = _traverse.default;

// url param kept for API consistency with other react_* functions
const react_webpackChunkPaths = async (_url: string, maxJsSizeMb: number, jsFiles: string[]): Promise<string[]> => {
    let toReturn: string[] = [];

    for (const jsFile of jsFiles) {
        try {
            const req = await makeRequest(jsFile);

            if (!req || req.status !== 200) continue;

            // check content-length before downloading body
            const contentLength = req.headers.get("content-length");
            if (contentLength && parseInt(contentLength) > maxJsSizeMb * 1024 * 1024) {
                console.error(chalk.yellow(`[!] Skipping ${jsFile} (too large)`));
                continue;
            }

            const jsContent = await req.text();

            if (jsContent.length > maxJsSizeMb * 1024 * 1024) {
                console.error(chalk.yellow(`[!] Skipping ${jsFile} (too large)`));
                continue;
            }

            const ast = parser.parse(jsContent, {
                sourceType: "unambiguous",
                plugins: ["jsx", "typescript"],
                errorRecovery: true,
            });

            // find arrow functions that look like webpack chunk path builders:
            // pattern 1: x.x = (e) => "prefix/" + ({...}[e] || e) + "." + {...}[e] + ".js"
            // pattern 2: x.x = (e) => { if (N === e) return "file.js"; ... }
            // pattern 3: x.x = function(e) { return ({N: "name", ...}[e] || e) + ".js"; }
            traverse(ast, {
                FunctionExpression(path) {
                    const start = path.node.start ?? 0;
                    const end = path.node.end ?? jsContent.length;
                    const source = jsContent.slice(start, end);

                    if (!source.match(/\|\|\s*e/) || !source.includes('".js"')) return;

                    const chunkMap: Array<[number, string]> = [];

                    path.traverse({
                        ObjectExpression(objPath) {
                            const props = objPath.node.properties;
                            if (props.length < 3) return;

                            const entries: Array<[number, string]> = [];
                            for (const prop of props) {
                                if (prop.type !== "ObjectProperty") continue;
                                const key = prop.key;
                                const value = prop.value;
                                if (value.type !== "StringLiteral") continue;

                                let keyNum: number | null = null;
                                if (key.type === "NumericLiteral") keyNum = key.value;
                                else if (key.type === "StringLiteral" && /^\d+$/.test(key.value))
                                    keyNum = parseInt(key.value);
                                else if (key.type === "Identifier" && /^\d+$/.test(key.name))
                                    keyNum = parseInt(key.name);

                                if (keyNum === null) continue;
                                entries.push([keyNum, value.value]);
                            }

                            if (entries.length >= 3) {
                                chunkMap.push(...entries);
                                objPath.stop();
                            }
                        },
                    });

                    if (chunkMap.length === 0) return;

                    console.log(chalk.green(`[✓] Found webpack object-map chunk path builder in ${jsFile}`));
                    console.log(chalk.yellow(source.slice(0, 200) + (source.length > 200 ? "..." : "")));

                    for (const [, chunkName] of chunkMap) {
                        try {
                            const output = "../" + chunkName + ".js";
                            const finalUrl = new URL(output, jsFile).href;
                            toReturn.push(finalUrl);
                        } catch {
                            // skip filenames that fail URL resolution
                        }
                    }
                },
                ArrowFunctionExpression(path) {
                    const start = path.node.start ?? 0;
                    const end = path.node.end ?? jsContent.length;
                    const source = jsContent.slice(start, end);

                    if (source.match(/"\.js".{0,15}$/)) {
                        // pattern 1: expression body returning computed path
                        console.log(chalk.green(`[✓] Found webpack chunk path builder in ${jsFile}`));
                        console.log(chalk.yellow(source.slice(0, 200) + (source.length > 200 ? "..." : "")));

                        const urlBuilderFunc = `(() => (${source}))()`;
                        const integers = source.match(/\d+/g);
                        if (!integers) return;

                        for (const i of integers) {
                            try {
                                let output = execFunc(urlBuilderFunc, parseInt(i));
                                if (typeof output !== "string" || output.includes("undefined")) continue;

                                if (!(
                                    output.startsWith("/") ||
                                    output.startsWith("http") ||
                                    output.startsWith("./") ||
                                    output.startsWith("../")
                                )) {
                                    output = "../" + output;
                                }
                                const finalUrl = new URL(output, jsFile).href;
                                toReturn.push(finalUrl);
                            } catch {
                                // skip integers that cause errors in sandboxed execution
                            }
                        }
                        return;
                    }

                    // pattern 2: block body with if-chain of literal filename returns
                    const body = path.node.body;
                    if (body.type !== "BlockStatement") return;

                    const filenames: string[] = [];
                    for (const stmt of body.body) {
                        if (stmt.type !== "IfStatement") continue;
                        const test = stmt.test;
                        if (test.type !== "BinaryExpression" || test.operator !== "===") continue;
                        const { left, right } = test;
                        const isNumericEqParam =
                            (left.type === "NumericLiteral" && right.type === "Identifier") ||
                            (right.type === "NumericLiteral" && left.type === "Identifier");
                        if (!isNumericEqParam) continue;
                        const consequent = stmt.consequent;
                        if (consequent.type !== "ReturnStatement" || !consequent.argument) continue;
                        const arg = consequent.argument;
                        if (arg.type !== "StringLiteral" || !arg.value.endsWith(".js")) continue;
                        filenames.push(arg.value);
                    }

                    if (filenames.length < 3) return;

                    console.log(chalk.green(`[✓] Found webpack if-chain chunk path builder in ${jsFile}`));
                    console.log(chalk.yellow(source.slice(0, 200) + (source.length > 200 ? "..." : "")));

                    for (const filename of filenames) {
                        try {
                            const output =
                                filename.startsWith("/") ||
                                filename.startsWith("http") ||
                                filename.startsWith("./") ||
                                filename.startsWith("../")
                                    ? filename
                                    : "../" + filename;
                            const finalUrl = new URL(output, jsFile).href;
                            toReturn.push(finalUrl);
                        } catch {
                            // skip filenames that fail URL resolution
                        }
                    }
                },
            });
        } catch (err) {
            console.error(chalk.red(`[!] Error processing ${jsFile}:`, err));
        }
    }

    if (toReturn.length > 0) {
        console.log(chalk.green(`[✓] Found ${toReturn.length} webpack chunk JS files`));
    }

    toReturn = [...new Set(toReturn)]; // dedupe the files
    return toReturn;
};

export default react_webpackChunkPaths;
