import makeRequest from "../../utility/makeReq.js";
import _traverse from "@babel/traverse";
import chalk from "chalk";
import parser from "@babel/parser";
import t from "@babel/types";

const traverse = _traverse.default;

const vue_getClientSidePaths = async (url: string, jsFiles: string[]): Promise<string[]> => {
    let toReturn: string[] = [];

    console.log(chalk.cyan(`[i] Extracting client-side paths from ${jsFiles.length} JS files...`));

    const baseOrigin = new URL(url).origin;

    // iterate through all those
    for (const jsFile of jsFiles) {
        if (!jsFile.endsWith(".js")) {
            continue;
        }
        const req = await makeRequest(jsFile);

        if (req == null) {
            console.log(chalk.red(`[!] Failed to fetch ${jsFile}`));
            continue;
        }

        const jsContent = await req.text();

        // load in ast
        let ast;

        try {
            ast = parser.parse(jsContent, {
                sourceType: "unambiguous",
                plugins: ["jsx", "typescript"],
                errorRecovery: true,
            });
        } catch {
            console.log(chalk.red(`[!] Failed to parse ${jsFile}`));
            continue;
        }

        const jsFileOrigin = new URL(jsFile).origin;

        traverse(ast, {
            ObjectProperty(path) {
                const { key, value } = path.node;

                if (
                    t.isIdentifier(key, { name: "link" }) &&
                    t.isStringLiteral(value) &&
                    t.isObjectExpression(path.parent)
                ) {
                    const linkVal = value.value;

                    if (linkVal.startsWith("/")) {
                        toReturn.push(baseOrigin + linkVal);
                    } else if (linkVal.startsWith("http") && new URL(linkVal).origin === jsFileOrigin) {
                        toReturn.push(linkVal);
                    }
                }
            },
        });
    }

    if (toReturn.length > 0) {
        console.log(chalk.green(`[+] Found ${toReturn.length} client-side paths from JS files!`));
    }
    return toReturn;
};

export default vue_getClientSidePaths;
