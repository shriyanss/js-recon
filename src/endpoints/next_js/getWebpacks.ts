import parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;
import chalk from "chalk";
import fs from "fs";
import path from "path";

const getWebpacks = (directory) => {
    console.log(chalk.cyan("[i] Getting webpacks"));
    let webpacks = {};
    // get all files in the directory
    let files;
    files = fs.readdirSync(directory, { recursive: true });

    // filter out the directories
    files = files.filter((file) => !fs.statSync(path.join(directory, file)).isDirectory());

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

            // find all the function definition like 219038: function() {}
            traverse(ast, {
                FunctionDeclaration(path) {
                    const name = path.node.id.name;
                    const body = path.node.body;

                    // check if the function name is an integer
                    if (!isNaN(name)) {
                        webpacks[name] = body;
                    }
                },
            });
        } catch (err) {
            continue;
        }
    }
    return webpacks;
};

export default getWebpacks;
