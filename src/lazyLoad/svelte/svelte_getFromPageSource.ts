import makeRequest from "../../utility/makeReq.js";
import * as cheerio from "cheerio";
import resolvePath from "../../utility/resolvePath.js";
import chalk from "chalk";
import { getJsUrls, pushToJsUrls } from "../globals.js";

/**
 * Finds all the lazy loaded JavaScript files from a webpage by parsing the page source.
 * It looks for all `<link>` tags with `rel="modulepreload"` attribute and `<script>` tags with `src` attribute.
 * It then resolves the relative URLs to absolute URLs and returns an array of all the JS files found.
 *
 * @param {string} url - The URL of the webpage to fetch and parse.
 * @returns {Promise<string[]>} - A promise that resolves to an array of absolute URLs pointing to JavaScript files found in the page.
 */
const svelte_getFromPageSource = async (url) => {
    console.log(chalk.cyan("[i] Analyzing page source"));
    let foundUrls = [];
    const pageSource = await makeRequest(url, {});
    const body = await pageSource.text();

    // cheerio to parse the page source
    const $ = cheerio.load(body);

    // find all link tags
    const linkTags = $("link");

    for (const linkTag of linkTags) {
        const relAttr = $(linkTag).attr("rel");
        if (relAttr === "modulepreload") {
            const hrefAttr = $(linkTag).attr("href");
            if (hrefAttr) {
                if (hrefAttr.startsWith("http")) {
                    foundUrls.push(hrefAttr);
                } else {
                    foundUrls.push(await resolvePath(url, hrefAttr));
                }
            }
        }
    }

    // also, parse the script tags
    const scriptTags = $("script");
    for (const scriptTag of scriptTags) {
        const srcAttr = $(scriptTag).attr("src");
        if (srcAttr) {
            if (srcAttr.startsWith("http")) {
                foundUrls.push(srcAttr);
            } else {
                foundUrls.push(await resolvePath(url, srcAttr));
            }
        }
    }

    if (foundUrls.length === 0) {
        console.log(chalk.red("[!] No JS files found from the page source"));
        return [];
    } else {
        console.log(chalk.green(`[✓] Found ${foundUrls.length} JS files from the page source`));
    }

    // iterate through the foundUrls and resolve the paths
    for (const foundUrl of foundUrls) {
        if (getJsUrls().includes(foundUrl)) {
            continue;
        }
        pushToJsUrls(foundUrl);
    }

    return foundUrls;
};
export default svelte_getFromPageSource;
