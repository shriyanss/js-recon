import fs from "fs";
import path from "path";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;
import chalk from "chalk";

import { Chunk, Chunks } from "../../utility/interfaces.js";

import * as globals from "../../utility/globals.js";
import { getCompletion } from "../../utility/ai.js";

const getWebpackConnections = async (directory, output, formats) => {
    const maxAiThreads = globals.getAiThreads();
    if (globals.getAi().length > 0) {
        // print a warning message about costs that might incur
        console.log(
            chalk.yellow(
                "[!] AI integration is enabled. This may incur costs. By using this feature, you agree to the AI provider's terms of service, and accept the risk of incurring unexpected costs due to huge codebase."
            )
        );
        const provider = globals.getAiServiceProvider();
        if (provider === "openai") {
            const apiKey =
                globals.getOpenaiApiKey() || process.env.OPENAI_API_KEY;
            if (!apiKey) {
                console.log(
                    chalk.red(
                        "[!] OpenAI API key not found. Please provide it via --openai-api-key or OPENAI_API_KEY environment variable."
                    )
                );
                process.exit(1);
            }
        }
        console.log(chalk.cyan(`[i] AI provider "${provider}" initialized.`));
    }

    // if the output file already exists, and AI mode is enabled, skip coz it burns $$$
    if (fs.existsSync(`${output}.json`) && globals.getAi().length > 0) {
        console.log(
            chalk.yellow(
                `[!] Output file ${output}.json already exists. Skipping regeneration to save costs.`
            )
        );
        const chunks = JSON.parse(fs.readFileSync(`${output}.json`, "utf8"));
        return chunks;
    }

    console.log(chalk.cyan("[i] Getting webpack connections"));
    // list all the files in the directory
    let files = fs.readdirSync(directory, {
        recursive: true,
        encoding: "utf8",
    });

    // remove all subsequent requests file from the list
    files = files.filter((file) => {
        return !file.includes("___subsequent_requests");
    });

    // remove all directories from the list
    files = files.filter((file) => {
        return !fs.lstatSync(path.join(directory, file)).isDirectory();
    });

    let chunks: Chunks = {};

    // read all the files, and get the chunks
    for (const file of files) {
        // if the first three lines of the file doesn't contain `self.webpackChunk_N_E`, continue
        const firstThreeLines = fs
            .readFileSync(path.join(directory, file.toString()), "utf8")
            .split("\n")
            .slice(0, 3);
        if (
            !firstThreeLines.some((line) =>
                line.includes("self.webpackChunk_N_E")
            )
        ) {
            continue;
        }

        // read the file
        const code = fs.readFileSync(
            path.join(directory, file.toString()),
            "utf8"
        );

        // parse the code with ast
        let ast;
        try {
            ast = parser.parse(code, {
                sourceType: "unambiguous",
                plugins: ["jsx", "typescript"],
                errorRecovery: true
            });
        } catch (err) {
            continue;
        }

        // traverse the ast
        traverse(ast, {
            CallExpression(path) {
                const callee = path.get("callee");

                // check if the call expression is a push to a webpack chunk
                if (
                    !callee.isMemberExpression() ||
                    !callee.get("property").isIdentifier({ name: "push" })
                ) {
                    return;
                }

                let object = callee.get("object");
                if (object.isAssignmentExpression()) {
                    object = object.get("left");
                }

                if (
                    !(
                        object.isMemberExpression() &&
                        object.get("property").isIdentifier() &&
                        object
                            .get("property")
                            .node.name.startsWith("webpackChunk")
                    )
                ) {
                    return;
                }

                // get the first argument of the push call
                const arg = path.get("arguments.0");
                if (!arg || !arg.isArrayExpression()) {
                    return;
                }

                // find the object expression in the arguments
                const elements = arg.get("elements");
                for (const element of elements) {
                    if (element.isObjectExpression()) {
                        const properties = element.get("properties");
                        for (const prop of properties) {
                            if (prop.isObjectProperty()) {
                                const key = prop.get("key");
                                if (
                                    key.isNumericLiteral() ||
                                    key.isStringLiteral()
                                ) {
                                    const keyValue = key.node.value;
                                    const function_code = code
                                        .slice(prop.node.start, prop.node.end)
                                        .replace(
                                            /^\s*[\w\d]+:\s+function\s+/,
                                            `function webpack_${keyValue} `
                                        )
                                        .replace(
                                            /^s*[\w\d]+:\s\(/,
                                            `func_${keyValue} = (`
                                        );
                                    chunks[String(keyValue)] = {
                                        id: String(keyValue),
                                        description: "none",
                                        loadedOn: [],
                                        containsFetch: false,
                                        exports: "string",
                                        callStack: [],
                                        code: function_code,
                                        imports: [],
                                        file: file,
                                    };
                                }
                            }
                        }
                    }
                }
            },
        });
    }

    // now, iterate through every chunk, and find the imports in the function
    console.log(chalk.cyan("[i] Finding imports for chunks"));
    for (const [key, value] of Object.entries(chunks)) {
        let ast;
        try {
            ast = parser.parse(value.code, {
                sourceType: "unambiguous",
                plugins: ["jsx", "typescript"],
                errorRecovery: true
            });
        } catch (err) {
            continue;
        }

        // if the function has three arguments, get the name of the third argument
        let thirdArgName;
        traverse(ast, {
            FunctionDeclaration(path) {
                const args = path.get("params");
                if (args.length === 3) {
                    thirdArgName = args[2].node.name;
                }
            },
        });

        // if the function doesn't have three arguments, continue
        if (!thirdArgName) {
            continue;
        }

        // if the thirs argument, i.e. __webpack_require__ is present, then see if it is used
        // if yes, print the chunk name
        traverse(ast, {
            CallExpression(path) {
                const callee = path.get("callee");
                if (callee.isIdentifier({ name: thirdArgName })) {
                    // the id of the function
                    const id = path.get("arguments.0");
                    if (id) {
                        if (
                            id.node.value !== undefined &&
                            String(id.node.value).match(/^\d+$/) &&
                            id.node.value !== ""
                        ) {
                            chunks[key].imports.push(String(id.node.value));
                        }
                    }
                }
            },
        });
    }

    // if AI description is enabled, add them
    if (globals.getAi() && globals.getAi().includes("description")) {
        console.log(chalk.cyan("[i] Generating descriptions for chunks"));
        const chunkEntries = Object.entries(chunks);
        const descriptionPromises = [];
        let activeThreads = 0;
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const systemPrompt =
            "You are a code analyzer. You will be given a function from the webpack of a compiled Next.JS file. You have to generate a one-liner description of what the function does.";

        for (const [key, value] of chunkEntries) {
            while (activeThreads >= maxAiThreads) {
                await sleep(Math.floor(Math.random() * 451) + 50); // Sleep for 50-500ms
            }

            activeThreads++;
            const promise = (async () => {
                try {
                    const description = await getCompletion(
                        value.code,
                        systemPrompt
                    );
                    return { key, description };
                } catch (err) {
                    console.log(
                        chalk.red(
                            `[!] Error generating description for chunk ${key}: ${err.message}`
                        )
                    );
                    return { key, description: "none" };
                } finally {
                    activeThreads--;
                }
            })();
            descriptionPromises.push(promise);
        }

        const results = await Promise.all(descriptionPromises);

        results.forEach(({ key, description }) => {
            if (chunks[key]) {
                chunks[key].description = description || "none";
                console.log(
                    chalk.green(
                        `[✓] Generated description for ${key}: ${chunks[key].description}`
                    )
                );
            }
        });
    }

    console.log(
        chalk.green(`[✓] Found ${Object.keys(chunks).length} webpack functions`)
    );

    if (formats.includes("json")) {
        const chunks_json = JSON.stringify(chunks, null, 2);
        fs.writeFileSync(`${output}.json`, chunks_json);
        console.log(
            chalk.green(`[✓] Saved webpack connections to ${output}.json`)
        );
    }

    return chunks;
};

export default getWebpackConnections;
