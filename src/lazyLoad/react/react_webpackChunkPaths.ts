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
                console.log(chalk.yellow(`[!] Skipping ${jsFile} (too large)`));
                continue;
            }

            const jsContent = await req.text();

            if (jsContent.length > maxJsSizeMb * 1024 * 1024) {
                console.log(chalk.yellow(`[!] Skipping ${jsFile} (too large)`));
                continue;
            }

            const ast = parser.parse(jsContent, {
                sourceType: "unambiguous",
                plugins: ["jsx", "typescript"],
                errorRecovery: true,
            });

            // find arrow functions that look like webpack chunk path builders:
            // x.x = (e) => "prefix/" + ({...}[e] || e) + "." + {...}[e] + ".js"
            traverse(ast, {
                ArrowFunctionExpression(path) {
                    const start = path.node.start ?? 0;
                    const end = path.node.end ?? jsContent.length;
                    const source = jsContent.slice(start, end);
                    if (!source.match(/"\.js".{0,15}$/)) return;

                    console.log(chalk.green(`[✓] Found webpack chunk path builder in ${jsFile}`));
                    console.log(chalk.yellow(source.slice(0, 200) + (source.length > 200 ? "..." : "")));

                    const urlBuilderFunc = `(() => (${source}))()`;
                    const integers = source.match(/\d+/g);
                    if (!integers) return;

                    for (const i of integers) {
                        try {
                            let output = execFunc(urlBuilderFunc, parseInt(i));
                            if (typeof output !== "string" || output.includes("undefined")) continue;

                            if (
                                !(
                                    output.startsWith("/") ||
                                    output.startsWith("http") ||
                                    output.startsWith("./") ||
                                    output.startsWith("../")
                                )
                            ) {
                                output = "../" + output;
                            }
                            const finalUrl = new URL(output, jsFile).href;
                            toReturn.push(finalUrl);
                        } catch {
                            // skip integers that cause errors in sandboxed execution
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
