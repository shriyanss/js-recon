import chalk from "chalk";
import * as globals from "../globals.js";
import makeRequest from "../../utility/makeReq.js";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;

/**
 * Finds lazy-loaded JavaScript files from Next.js `_buildManifest.js`.
 *
 * Given a URL, this function finds the `_buildManifest.js` file in the given URL or file containing URLs.
 * It then parses the file with the Babel parser and extracts all string literals from the AST.
 * Finally, it iterates over the strings and finds any chunks (i.e., URLs containing "static/chunks/").
 * The function returns an array of absolute URLs pointing to the lazy-loaded JS files found.
 *
 * @param {string} url - The URL or path to a file containing a list of URLs to process.
 * @returns {Promise<string[] | any>} - A promise that resolves to an array of absolute URLs pointing to lazy-loaded JS files found, or undefined for invalid URL.
 */
const next_getLazyResourcesBuildManifestJs = async (url: string): Promise<string[] | any> => {
    // get the JS URLs
    const foundUrls = globals.getJsUrls();
    let toReturn: string[] = [];

    let buildManifestUrl: string = "";
    // iterate over them, and find the build manifest
    for (const jsUrl of foundUrls) {
        if (jsUrl.endsWith("_buildManifest.js")) {
            buildManifestUrl = jsUrl;
            break;
        }
    }

    if (buildManifestUrl === "") {
        return [];
    }

    // get the contents of that
    let buildManifestContent = await (await makeRequest(buildManifestUrl, {})).text();

    // parse it with babel parser
    const ast = parser.parse(buildManifestContent, {
        sourceType: "unambiguous",
        plugins: ["jsx", "typescript"],
        errorRecovery: true,
    });

    let strings: string[] = [];

    traverse(ast, {
        StringLiteral(path) {
            strings.push(path.node.value);
        },
    });

    // iterate over the strings, and find the chunks

    for (const stringTxt of strings) {
        if (stringTxt.includes("static/chunks/")) {
            // a chunk is found
            // bui;d the relative URL
            const foundUrl = new URL(`../../${stringTxt}`, buildManifestUrl).href;
            globals.pushToJsUrls(foundUrl);
            toReturn.push(foundUrl);
        }
    }

    if (toReturn.length > 0) {
        console.log(chalk.green(`[✓] Found ${toReturn.length} JS files from _buildManifest.js`));
    }

    return toReturn;
};

export default next_getLazyResourcesBuildManifestJs;
