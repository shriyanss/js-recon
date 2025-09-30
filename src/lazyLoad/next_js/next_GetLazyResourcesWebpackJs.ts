import chalk from "chalk";
import puppeteer from "puppeteer";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;
import inquirer from "inquirer";
import CONFIG from "../../globalConfig.js";
import makeRequest from "../../utility/makeReq.js";
import execFunc from "../../utility/runSandboxed.js";
import { getJsonUrls, getJsUrls, pushToJsonUrls, pushToJsUrls } from "../globals.js"; // Import js_urls functions
import * as globals from "../../utility/globals.js";

/**
 * Finds all the lazy loaded JS files from a given URL using a Next.js
 * specific approach. It works by first parsing the HTML of the page
 * and then extracting all the JS files from it. Then it parses the
 * contents of each JS file and extracts all the functions from it.
 * Then it iterates through the functions and finds out which one
 * ends with `.js`. It then asks the user if this is the correct
 * function, and if so, it proceeds to use the function to fetch
 * all the lazy loaded JS files.
 *
 * @param {string} url - The URL of the webpage to fetch and parse.
 * @returns {Promise<string[] | any>} - A promise that resolves to an array of
 * absolute URLs pointing to JavaScript files found in the page, or undefined for invalid URL.
 */
const next_GetLazyResourcesWebpackJs = async (url: string): Promise<string[] | any> => {
    const browser = await puppeteer.launch({
        headless: true,
        args: globals.getDisableSandbox() ? ["--no-sandbox", "--disable-setuid-sandbox"] : [],
    });

    const page = await browser.newPage();

    await page.setRequestInterception(true);

    page.on("request", async (request) => {
        // get the request url
        const req_url = request.url(); // Renamed to avoid conflict with outer 'url'

        // see if the request is a JS file, and is a get request
        if (request.method() === "GET" && req_url.match(/https?:\/\/[a-z0-9:\._\-]+\/.+\.js\??.*/)) {
            if (!getJsUrls().includes(req_url)) {
                pushToJsUrls(req_url);
            }
        }

        // check if the request is a JSON file with a get request
        if (request.method() === "GET" && req_url.match(/https?:\/\/[\d\w\.\-]+\/.+\.json\??.*$/)) {
            if (!getJsonUrls().includes(req_url)) {
                pushToJsonUrls(req_url);
            }
        }
        await request.continue();
    });

    try {
        await page.goto(url, { waitUntil: "networkidle0" });
    } catch (err) {
        console.log(chalk.yellow("[!] Timeout reached for page load. Continuing with the current state"));
    }

    await browser.close();

    let webpack_js = "";

    // iterate through JS files
    for (const js_url of getJsUrls()) {
        // match for webpack js file
        if (js_url.match(/\/webpack.*\.js/)) {
            console.log(chalk.green(`[✓] Found webpack JS file at ${js_url}`));
            webpack_js = js_url;
        }
    }

    if (!webpack_js) {
        console.log(chalk.red("[!] No webpack JS file found"));
        console.log(chalk.magenta(CONFIG.notFoundMessage));
        return []; // Return undefined as per JSDoc
    }

    // parse the webpack JS file
    const res = await makeRequest(webpack_js, {});
    const webpack_js_source = await res.text();

    // parse it with @babel/*
    const ast = parser.parse(webpack_js_source, {
        sourceType: "unambiguous",
        plugins: ["jsx", "typescript"],
        errorRecovery: true,
    });

    let functions = [];

    traverse(ast, {
        FunctionDeclaration(path) {
            functions.push({
                name: path.node.id?.name || "(anonymous)",
                type: "FunctionDeclaration",
                source: webpack_js_source.slice(path.node.start, path.node.end),
            });
        },
        FunctionExpression(path) {
            functions.push({
                name: path.parent.id?.name || "(anonymous)",
                type: "FunctionExpression",
                source: webpack_js_source.slice(path.node.start, path.node.end),
            });
        },
        ArrowFunctionExpression(path) {
            functions.push({
                name: path.parent.id?.name || "(anonymous)",
                type: "ArrowFunctionExpression",
                source: webpack_js_source.slice(path.node.start, path.node.end),
            });
        },
        ObjectMethod(path) {
            functions.push({
                name: path.node.key.name,
                type: "ObjectMethod",
                source: webpack_js_source.slice(path.node.start, path.node.end),
            });
        },
        ClassMethod(path) {
            functions.push({
                name: path.node.key.name,
                type: "ClassMethod",
                source: webpack_js_source.slice(path.node.start, path.node.end),
            });
        },
    });

    let user_verified = false;
    // method 1
    // iterate through the functions, and find out which one ends with `".js"`

    let final_Func;
    for (const func of functions) {
        if (func.source.match(/"\.js".{0,15}$/)) {
            console.log(chalk.green(`[✓] Found JS chunk having the following source`));
            console.log(chalk.yellow(func.source));
            final_Func = func.source;
        }
    }

    if (!final_Func) {
        // Added check if final_Func was not found
        console.log(chalk.red("[!] No suitable function found in webpack JS for lazy loading."));
        return [];
    }

    //   ask through input if this is the right thing
    if (!globals.getYes()) {
        const askCorrectFuncConfirmation = async () => {
            const { confirmed } = await inquirer.prompt([
                {
                    type: "confirm",
                    name: "confirmed",
                    message: "Is this the correct function?",
                    default: true,
                },
            ]);
            return confirmed;
        };

        user_verified = await askCorrectFuncConfirmation();
        if (user_verified === true) {
            console.log(chalk.cyan("[i] Proceeding with the selected function to fetch files"));
        } else {
            console.log(chalk.red("[!] Not executing function."));
            return [];
        }
    }

    const urlBuilderFunc = `(() => (${final_Func}))()`;

    let js_paths = [];
    try {
        // rather than fuzzing, grep the integers from the func code
        const integers = final_Func.match(/\d+/g);
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
    } catch (err) {
        console.error("Unsafe or invalid code:", err.message);
        return [];
    }

    if (js_paths.length > 0) {
        console.log(chalk.green(`[✓] Found ${js_paths.length} JS chunks`));
    }

    // build final URL
    let final_urls = [];
    for (let i = 0; i < js_paths.length; i++) {
        // following is a broken logic

        // get the directory of webpack file
        // const webpack_dir = webpack_js.split("/").slice(0, -1).join("/");
        // // replace the filename from the js path
        // const js_path_dir = js_paths[i].replace(/\/[a-zA-Z0-9\.]+\.js.*$/, "");
        // const final_url = webpack_dir.replace(js_path_dir, js_paths[i]);
        // final_urls.push(final_url);

        // logic that works:
        const webpack_dir = webpack_js.split("/").slice(0, -2).join("/");
        const js_path_dir = new URL(js_paths[i], webpack_dir).href;
        final_urls.push(js_path_dir);
    }

    return final_urls;
};

export default next_GetLazyResourcesWebpackJs;
