import chalk from "chalk";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;
import fs from "fs";
import path from "path";

const client_jsonParse = async (directory: string): Promise<string[]> => {
    let foundUrls = [];
    console.log(
        chalk.cyan("[i] Searching for client-side paths in JSON.parse()")
    );

    // filter out the directories
    let files = fs.readdirSync(directory, {
        recursive: true,
        encoding: "utf8",
    });
    files = files.filter(
        (file) => !fs.statSync(path.join(directory, file)).isDirectory()
    );

    // filter out the subsequent requests files
    files = files.filter((file) => !file.startsWith("___subsequent_requests"));

    for (const file of files) {
        // read the file
        const code = fs.readFileSync(path.join(directory, file), "utf8");

        // parse the code with ast
        let ast;
        try {
            ast = parser.parse(code, {
                sourceType: "unambiguous",
                plugins: ["jsx", "typescript"],
            });

            // traverse the ast, and find all the instances where JSON.parse() is used with a string as its
            // argument, and if you parse that string, it contains paths
            traverse(ast, {
                CallExpression(path) {
                    const callee = path.get("callee");
                    if (callee.matchesPattern("JSON.parse")) {
                        const args = path.get("arguments");
                        if (args.length > 0 && args[0].isStringLiteral()) {
                            const jsonString = args[0].node.value;
                            try {
                                const parsedData = JSON.parse(jsonString);

                                // get all the keys of parsedData
                                const keys = Object.keys(parsedData);

                                // check if they all match the regex of path
                                let matched = true;

                                for (const key of keys) {
                                    if (!key.match(/^\/[\w\.\/\-]*$/)) {
                                        matched = false;
                                        break;
                                    }
                                }

                                if (matched) {
                                    // push all the keys to foundUrls
                                    foundUrls.push(...keys);
                                }
                            } catch (e) {
                                // Ignore errors from JSON.parse
                            }
                        }
                    }
                },
            });
        } catch (err) {
            console.error(chalk.red(`[!] Error when parsing JSON: ${err}`));
        }
    }

    return foundUrls;
};

export default client_jsonParse;
