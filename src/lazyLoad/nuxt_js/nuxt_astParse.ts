import parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;
import execFunc from "../../utility/runSandboxed.js";
import makeRequest from "../../utility/makeReq.js";
import chalk from "chalk";
import inquirer from "inquirer";
import t from "@babel/types";
import resolvePath from "../../utility/resolvePath.js";
import * as globals from "../../utility/globals.js";

/**
 * Finds all the lazy loaded JS files from a given URL using a Nuxt.js specific approach.
 * It works by first parsing the HTML of the page and then extracting all the JS files from it.
 * Then it parses the contents of each JS file and extracts all the functions from it.
 * Then it iterates through the functions, and finds out the one that ends with ".js"
 * and then asks the user to verify if this is the correct function.
 * If the user verifies, it proceeds to execute the function with all possible numbers
 * and then resolves the output to absolute URLs pointing to JavaScript files found in the page.
 * @param {string} url - The URL of the webpage to fetch and parse.
 * @returns {Promise<string[] | any>} - A promise that resolves to an array of absolute URLs pointing to
 * JavaScript files found in the page, or undefined for invalid URL.
 */
const nuxt_astParse = async (url: string) => {
    let filesFound = [];
    const resp = await makeRequest(url, {});
    const body = await resp.text();

    let ast;
    try {
        ast = parser.parse(body, {
            sourceType: "module",
            plugins: ["jsx", "typescript"],
            errorRecovery: true,
        });
    } catch (error) {
        console.log(chalk.red("[!] Error parsing JS file: ", url));
        return filesFound;
    }

    let functions = [];

    traverse(ast, {
        FunctionDeclaration(path) {
            functions.push({
                name: path.node.id?.name || "(anonymous)",
                type: "FunctionDeclaration",
                source: body.slice(path.node.start, path.node.end),
            });
        },
        FunctionExpression(path) {
            functions.push({
                name: path.parent.id?.name || "(anonymous)",
                type: "FunctionExpression",
                source: body.slice(path.node.start, path.node.end),
            });
        },
        ArrowFunctionExpression(path) {
            functions.push({
                name: path.parent.id?.name || "(anonymous)",
                type: "ArrowFunctionExpression",
                source: body.slice(path.node.start, path.node.end),
            });
        },
        ObjectMethod(path) {
            functions.push({
                name: path.node.key.name,
                type: "ObjectMethod",
                source: body.slice(path.node.start, path.node.end),
            });
        },
        ClassMethod(path) {
            functions.push({
                name: path.node.key.name,
                type: "ClassMethod",
                source: body.slice(path.node.start, path.node.end),
            });
        },
    });

    // iterate through the functions, and find out the one that ends with ".js"

    for (const func of functions) {
        if (func.source.match(/"\.js".{0,15}$/)) {
            console.log(chalk.green(`[✓] Found JS chunk having the following source:`));
            console.log(chalk.yellow(func.source));

            let user_verified;
            if (!globals.getYes()) {
                const askCorrectFuncConfirmation = async () => {
                    const { value } = await inquirer.prompt([
                        {
                            type: "confirm",
                            name: "value",
                            message: "Is this the correct function?",
                            default: true,
                        },
                    ]);
                    return value;
                };

                user_verified = await askCorrectFuncConfirmation();
            } else {
                user_verified = true;
            }
            if (user_verified === true) {
                console.log(chalk.cyan("[i] Proceeding with the selected function to fetch files"));
            } else {
                console.log(chalk.red("[!] Not executing function."));
                continue;
            }
            // get the value of the unknown vars
            // first, get the name of the unknown function
            const unknownVarAst = parser.parse(`(${func.source})`, {
                sourceType: "script",
                plugins: ["jsx", "typescript"],
                errorRecovery: true,
            });
            let memberExpressions = [];
            traverse(unknownVarAst, {
                MemberExpression(path) {
                    // Only collect identifiers like f.p (not obj["x"])
                    if (
                        t.isIdentifier(path.node.object) &&
                        t.isIdentifier(path.node.property) &&
                        !path.node.computed // ignore obj["x"]
                    ) {
                        const objName = path.node.object.name;
                        const propName = path.node.property.name;
                        memberExpressions.push(`${objName}.${propName}`);
                    }
                },
            });

            const unknownVar = memberExpressions[0].split(".");

            // now, resolve the value of this unknown var
            let unknownVarValue;

            traverse(ast, {
                AssignmentExpression(path) {
                    const { left, right } = path.node;

                    if (
                        t.isMemberExpression(left) &&
                        t.isIdentifier(left.object, { name: unknownVar[0] }) &&
                        t.isIdentifier(left.property, {
                            name: unknownVar[1],
                        }) &&
                        !left.computed
                    ) {
                        if (t.isStringLiteral(right)) {
                            unknownVarValue = right.value;
                        } else {
                            // fallback to source snippet
                            unknownVarValue = func.source.slice(right.start, right.end);
                        }
                    }
                },
            });

            // replace the unknown var with the value
            const funcSource = func.source.replace(
                new RegExp(`${unknownVar[0]}.${unknownVar[1]}`),
                `"${unknownVarValue}"`
            );

            // continue to executing the function with all possible numbers
            const urlBuilderFunc = `(() => (${funcSource}))()`;
            let js_paths = [];

            try {
                // rather than fuzzing, grep the integers from the func code
                const integers = funcSource.match(/\d+/g);
                if (integers) {
                    // Check if integers were found
                    // iterate through all integers, and get the output
                    for (const i of integers) {
                        const output = execFunc(urlBuilderFunc, parseInt(i));
                        if (output.includes("undefined")) {
                            continue;
                        } else {
                            js_paths.push(output);
                        }
                    }
                }
            } catch (error) {
                console.log(chalk.red("[!] Error executing function: ", error));
            }

            if (js_paths.length > 0) {
                // iterate through the files, and resolve them
                for (const js_path of js_paths) {
                    const resolvedPath = await resolvePath(url, js_path);
                    filesFound.push(resolvedPath);
                }
            }
        }
    }

    if (filesFound.length > 0) {
        console.log(chalk.green(`[✓] Found ${filesFound.length} JS chunks`));
    }

    return filesFound;
};

export default nuxt_astParse;
