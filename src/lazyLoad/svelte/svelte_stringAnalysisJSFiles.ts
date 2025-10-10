import chalk from "chalk";
import makeRequest from "../../utility/makeReq.js";
import { getJsUrls, pushToJsUrls } from "../globals.js";
import resolvePath from "../../utility/resolvePath.js";

// for parsing
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import { FoundJsFiles } from "../../utility/interfaces.js";
const traverse = _traverse.default;

let analyzedFiles = [];
let filesFound = [];

/**
 * Parses the content of a JavaScript file and returns an object containing
 * all the strings that end with ".js".
 *
 * @param {string} content - The content of the JavaScript file to parse.
 * @returns {Promise<FoundJsFiles>} - A promise that resolves to an object containing
 * all the strings that end with ".js".
 */
const parseJSFileContent = async (content) => {
    try {
        const ast = parser.parse(content, {
            sourceType: "module",
            plugins: ["jsx", "typescript"],
            errorRecovery: true,
        });

        let foundJsFiles = {};

        traverse(ast, {
            StringLiteral(path) {
                const value = path.node.value;
                if (value.startsWith("./") && value.endsWith(".js")) {
                    foundJsFiles[value] = value;
                } else if (value.startsWith("../") && value.endsWith(".js")) {
                    foundJsFiles[value] = value;
                } else if (value.endsWith(".js")) {
                    foundJsFiles[value] = value;
                }
            },
        });

        return foundJsFiles;
    } catch (error) {
        // console.error(error);
        return {};
    }
};

/**
 * Analyzes strings in the files found and returns an array of absolute URLs pointing to JavaScript files found in the page.
 * @param {string} url - The URL of the webpage to fetch and parse.
 * @returns {Promise<string[]>} - A promise that resolves to an array of absolute URLs pointing to JavaScript files found in the page.
 */
const svelte_stringAnalysisJSFiles = async (url) => {
    console.log(chalk.cyan("[i] Analyzing strings in the files found"));

    while (true) {
        // get all the JS URLs
        const js_urls = getJsUrls();

        if (js_urls.length === 0) {
            console.log(chalk.red("[!] No JS files found for string analysis"));
            break;
        }

        // if js_urls have everything that is in analyzedFiles, break
        let everythingAnalyzed = true;
        for (const url of js_urls) {
            //   if the url is not in analyzedFiles, set everythingAnalyzed to false
            if (!analyzedFiles.includes(url)) {
                everythingAnalyzed = false;
            }
        }

        // break if everything is analyzed
        if (everythingAnalyzed) {
            break;
        }

        // iterate through the JS URLs
        for (const js_url of js_urls) {
            if (analyzedFiles.includes(js_url)) {
                continue;
            }

            const response = await makeRequest(js_url, {});
            const respText = await response.text();
            const foundJsFiles: FoundJsFiles = await parseJSFileContent(respText);

            // iterate through the foundJsFiles and resolve the paths
            for (const [key, value] of Object.entries(foundJsFiles)) {
                const resolvedPath = await resolvePath(js_url, value);
                if (analyzedFiles.includes(resolvedPath)) {
                    continue;
                }
                pushToJsUrls(resolvedPath);
                filesFound.push(resolvedPath);
            }

            analyzedFiles.push(js_url);
        }
    }

    // dedupe the files
    filesFound = [...new Set(filesFound)];

    console.log(chalk.green(`[✓] Found ${filesFound.length} JS files from string analysis`));

    return filesFound;
};

export default svelte_stringAnalysisJSFiles;
