import chalk from "chalk";
import puppeteer from "puppeteer";

/**
 * Downloads all the lazy loaded JS files from a given URL.
 *
 * It opens a headless browser instance, navigates to the given URL, and
 * intercepts all the requests. It checks if the request is a JS file
 * and if it is a GET request. If both conditions are satisfied, the URL
 * is added to the array of URLs. Finally, it closes the browser instance
 * and returns the array of URLs.
 *
 * @param {string} url - The URL of the webpage to fetch and parse.
 * @returns {Promise<string[]|undefined>} - A promise that resolves to an array of
 * absolute URLs pointing to JavaScript files found in the page, or undefined for invalid URL.
 */
const downloadLoadedJs = async (url) => {
    if (!url.match(/https?:\/\/[a-zA-Z0-9\._\-]+/)) {
        console.log(chalk.red("[!] Invalid URL"));
        return; // Return undefined as per JSDoc
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: process.env.IS_DOCKER === "true" ? ["--no-sandbox"] : [],
    });

    const page = await browser.newPage();

    await page.setRequestInterception(true);

    let js_urls_local = []; // Use a local variable, not the global one
    page.on("request", async (request) => {
        // get the request url
        const req_url = request.url(); // Renamed to avoid conflict with outer 'url'

        // see if the request is a JS file, and is a get request
        if (
            request.method() === "GET" &&
            req_url.match(/https?:\/\/[a-z\._\-]+\/.+\.js\??.*/)
        ) {
            js_urls_local.push(req_url);
        }

        await request.continue();
    });

    await page.goto(url);

    await browser.close();

    return js_urls_local;
};

export default downloadLoadedJs;
