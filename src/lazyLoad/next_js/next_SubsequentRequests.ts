import chalk from "chalk";
import fs from "fs";
import path from "path";
import { getURLDirectory } from "../../utility/urlUtils.js";
import makeRequest from "../../utility/makeReq.js";
import * as cheerio from "cheerio";

let queue = 0;
let max_queue;

/**
 * Finds all static JS files from a given JavaScript content.
 * @param {string} js_content - The JavaScript content to search in.
 * @returns {Promise<string[]>} - A promise that resolves to an array of static JS file URLs.
 */
const findStaticFiles = async (js_content) => {
    // do some regex-ing
    const matches = [...js_content.matchAll(/\/?static\/chunks\/[a-zA-Z0-9\._\-\/]+\.js/g)];
    // return matches

    let toReturn = [];

    for (const match of matches) {
        toReturn.push(match[0]);
    }

    return toReturn;
};

const getURLDirectoryServer = (urlString) => {
    const url = new URL(urlString);
    const pathParts = url.pathname.split("/").filter(Boolean); // ['business', 'api']
    pathParts.pop(); // Remove 'api'

    const newPath = "/" + pathParts.join("/"); // '/business'
    return `${url.origin}${newPath}`; // 'http://something.com/business'
};

const subsequentRequests = async (url, urlsFile, threads, output, js_urls): Promise<string[] | any> => {
    max_queue = threads;
    let staticJSURLs = [];

    console.log(chalk.cyan(`[i] Fetching JS files from subsequent requests`));

    // open the urls file, and load the paths (JSON)
    if (!fs.existsSync(urlsFile)) {
        console.log(chalk.red(`[!] URLs file ${urlsFile} does not exist`));
        console.log(chalk.yellow(`[!] Please run strings module first with -e flag`));
        console.log(chalk.yellow(`[!] Example: js-recon strings -d <directory> -e`));
        process.exit(17);
    }
    let endpoints = JSON.parse(fs.readFileSync(urlsFile, "utf8")).paths;

    // add `/` to endpoints
    endpoints.push("/");

    let js_contents = {};

    // make requests to all of them with the special header
    const reqPromises = endpoints.map(async (endpoint) => {
        const reqUrl = new URL(endpoint, url).href;
        try {
            // delay in case over the thread count
            while (queue >= max_queue) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            queue++;

            const res = await makeRequest(reqUrl, {
                headers: {
                    RSC: "1",
                },
            });

            if (res && res.status === 200 && res.headers.get("content-type").includes("text/x-component")) {
                const text = await res.text();
                js_contents[endpoint] = text;

                const { host, directory } = getURLDirectory(reqUrl);

                // save the contents to "___subsequent_requests/"
                // make the subsequent_requests directory if it doesn't exist

                const output_path = path.join(output, host, "___subsequent_requests", directory);
                if (!fs.existsSync(output_path)) {
                    fs.mkdirSync(output_path, { recursive: true });
                }
                fs.writeFileSync(path.join(output_path, "index.js"), text);

                // find the static ones from the JS resp
                const staticFiles = await findStaticFiles(text);

                // go through each file and get the absolute path of those
                const absolutePaths = staticFiles.map((file) => {
                    // go through existing JS URLs found
                    let js_path_dir;
                    for (const js_url of js_urls) {
                        if (
                            !js_path_dir &&
                            new URL(js_url).host === new URL(url).host &&
                            new URL(js_url).pathname.includes("static/chunks/")
                        ) {
                            js_path_dir = js_url.replace(/\/[^\/]+\.js.*$/, "");
                        }
                    }
                    return js_path_dir.replace("static/chunks", "") + file;
                });

                // Filter out paths that are already in js_urls before pushing to staticJSURLs
                const newPaths = absolutePaths.filter((path) => !js_urls.includes(path));
                if (newPaths.length > 0) {
                    staticJSURLs.push(...newPaths);
                }
            }

            queue--;
        } catch (e) {
            queue--;
            console.log(chalk.red(`[!] Error fetching ${reqUrl}: ${e}`));
        }
    });

    await Promise.all(reqPromises);

    staticJSURLs = [...new Set(staticJSURLs)];

    // in addition to the RSC:1 method, the script tags on the webpage of valid client-side paths also have the JS files
    // since we found the possible paths in the previous iteration, we can use that to find the JS files on those pages
    // as well

    let jsFilesFromPageHtml: string[] = [];
    for (const endpoint of endpoints) {
        const reqUrl = new URL(endpoint, url).href;

        // make the request to get the contents of the webpage

        const req = await makeRequest(reqUrl);
        const resText = await req.text();
        const $ = cheerio.load(resText);

        const extract_regex = /static\/chunks\/[a-zA-Z0-9_\-]+\.js/g;

        // find all script tags
        $("script").each((_, script) => {
            // make sure that is doesn't have src attribute
            if (!$(script).attr("src")) {
                // get the content of the script tag
                const scriptContent = $(script).html();
                if (scriptContent) {
                    // parse the script tag contents
                    // it would be something like the following:
                    // self.__next_f.push([1,"1:\"$Sreact.fragment\"\n2:I[13032,[\"2090\",\"static/chunks/2090.....
                    // just use regex :/

                    const matches = scriptContent.matchAll(extract_regex);
                    for (const match of matches) {
                        jsFilesFromPageHtml.push(match[0]);
                    }
                }
            }
        });
    }

    // build the full URL from path
    jsFilesFromPageHtml = jsFilesFromPageHtml.map((file) => {
        // go through existing JS URLs found
        let js_path_dir;
        for (const js_url of js_urls) {
            if (
                !js_path_dir &&
                new URL(js_url).host === new URL(url).host &&
                new URL(js_url).pathname.includes("static/chunks/")
            ) {
                js_path_dir = js_url.replace(/\/[^\/]+\.js.*$/, "");
            }
        }
        if (js_path_dir) {
            return js_path_dir.replace("static/chunks", "") + file;
        }
        return file;
    });

    // dedupe
    jsFilesFromPageHtml = [...new Set(jsFilesFromPageHtml)];

    console.log(chalk.green(`[✓] Found ${(new Set([...staticJSURLs, ...jsFilesFromPageHtml])).size} JS chunks from page HTML`));

    return new Set([...staticJSURLs, ...jsFilesFromPageHtml]);
};

export default subsequentRequests;
