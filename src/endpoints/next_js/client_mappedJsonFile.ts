import chalk from "chalk";
import fs from "fs";
import path from "path";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;
import { Chunks } from "../../utility/interfaces.js";

const client_mappedJsonFile = async (filePath: string) => {
    console.log(chalk.cyan("[i] Checking for client-side paths from mapped JSON file"));

    // open the file and load the chunks
    const chunks: Chunks = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    let foundPaths: string[] = [];

    // iterate over the chunks
    for (const [key, value] of Object.entries(chunks)) {
        // see if the chunk code string contains window.__NEXT_P string
        if (value.code.includes("window.__NEXT_P")) {
            const ast = parser.parse(value.code, {
                sourceType: "unambiguous",
                plugins: ["jsx", "typescript"],
                errorRecovery: true,
            });

            traverse(ast, {
                
            });
        }
    }
};

export default client_mappedJsonFile;
