import chalk from "chalk";
import puppeteer from "puppeteer";
import * as globalsUtil from "../utility/globals.js";

/**
 * Downloads all the lazy loaded JS files from a given URL.
 * @param {string} url - The URL of the webpage to fetch and parse.
 * @returns {Promise<string[]>} - A promise that resolves to an array of absolute URLs pointing to JavaScript files found in the page, or undefined for invalid URL.
 */
const downloadLoadedJs = async (url) => {
    if (!url.match(/https?:\/\/[a-zA-Z0-9\._\-]+/)) {
        console.log(chalk.red("[!] Invalid URL"));
        return; // Return undefined as per JSDoc
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: globalsUtil.getDisableSandbox() ? ["--no-sandbox"] : [],
    });

    const page = await browser.newPage();

    await page.setRequestInterception(true);

    let js_urls_local = []; // Use a local variable, not the global one
    page.on("request", async (request) => {
        // get the request url
        const req_url = request.url(); // Renamed to avoid conflict with outer 'url'

        // see if the request is a JS file, and is a get request
        if (request.method() === "GET" && req_url.match(/https?:\/\/[a-z0-9:\._\-]+\/.+\.js\??.*/)) {
            js_urls_local.push(req_url);
        }

        await request.continue();
    });

    await page.goto(url);

    await browser.close();

    return js_urls_local;
};

export default downloadLoadedJs;
