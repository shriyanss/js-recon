import chalk from "chalk";
import fs from "fs";
import path from "path";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import prettier from "prettier";

const traverse = _traverse.default;


/**
 * Extracts all string literals from all .js files in a given directory and its
 * subdirectories and writes them to a JSON file.
 * @param {string} directory - The directory to scan for .js files
 * @param {string} output_file - The file to write the extracted strings to
 */
const strings = async (directory, output_file) => {
    console.log(chalk.cyan("[i] Loading 'Strings' module"));

    // check if the directory exists
    if (!fs.existsSync(directory)) {
        console.log(chalk.red("[!] Directory does not exist"));
        return;
    }

    console.log(chalk.cyan(`[i] Scanning ${directory} directory`));

    // get all files in the directory and sub-directories
    const files = fs.readdirSync(directory, { recursive: true });

    // filter out non JS files
    const jsFiles = files.filter((file) => file.endsWith(".js"));

    // read all JS files
    let js_files_path = [];
    for (const file of jsFiles) {
        const filePath = path.join(directory, file);
        js_files_path.push(filePath);
    }

    console.log(chalk.cyan(`[i] Found ${js_files_path.length} JS files`));

    // read all JS files
    let all_strings = {};
    for (const file of js_files_path) {
        const fileContent = fs.readFileSync(file, "utf-8");
        
        // parse the file contents with babel
        const ast = parser.parse(fileContent, {
            sourceType: "unambiguous",
            plugins: ["jsx", "typescript"],
        });

        let strings = [];

        traverse(ast, {
            StringLiteral(path) {
                strings.push(path.node.value);
            },
        });
        
        all_strings[file] = strings;
    }

    let strings_count = 0;
    for (const file of Object.keys(all_strings)) {
        strings_count += all_strings[file].length;
    }

    console.log(chalk.cyan(`[i] Extracted ${strings_count} strings`));

    // write to a JSON file
    const formatted = await prettier.format(JSON.stringify(all_strings), {
        parser: "json",
        printWidth: 80,
        singleQuote: true,
    });
    fs.writeFileSync(output_file, formatted);

    console.log(chalk.green(`[✓] Extracted strings to ${output_file}`));
};

export default strings;
