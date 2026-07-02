import chalk from "chalk";
import * as globalsUtil from "../utility/globals.js";
import puppeteer from "../utility/puppeteerInstance.js";
import { getChromiumPath } from "../utility/getChromiumPath.js";

/**
 * Downloads all the lazy loaded JS files from a given URL.
 * @param {string} url - The URL of the webpage to fetch and parse.
 * @returns {Promise<string[]>} - A promise that resolves to an array of absolute URLs pointing to JavaScript files found in the page, or undefined for invalid URL.
 */
const downloadLoadedJs = async (url) => {
    if (!url.match(/https?:\/\/[a-zA-Z0-9\._\-]+/)) {
        console.error(chalk.red("[!] Invalid URL"));
        return; // Return undefined as per JSDoc
    }

    const chromiumPath = getChromiumPath();
    const sandboxArgs = globalsUtil.getDisableSandbox()
        ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        : [];
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: chromiumPath,
        args: [
            // Prevent Chrome from handing mailto:/tel:/etc. to the OS
            "--disable-external-protocol-dialog",
            ...sandboxArgs,
        ],
    });

    const page = await browser.newPage();

    // Belt-and-suspenders: block non-http/s navigation at the JS level too.
    // Chrome's protocol-handler path bypasses Puppeteer's request interception,
    // so we also need to override window.open and swallow clicks on non-http/s
    // anchors before they reach the browser's handler dispatch.
    await page.evaluateOnNewDocument(() => {
        const origOpen = window.open.bind(window);
        window.open = (url?: string | URL, ...rest: string[]) => {
            if (url != null && !/^https?:/i.test(String(url))) return null;
            return origOpen(url, ...rest);
        };
        document.addEventListener(
            "click",
            (e) => {
                const anchor = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
                if (anchor && !/^https?:/i.test(anchor.href)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            },
            true,
        );
    });

    await page.setRequestInterception(true);

    let js_urls_local = []; // Use a local variable, not the global one
    page.on("request", async (request) => {
        // get the request url
        const req_url = request.url(); // Renamed to avoid conflict with outer 'url'

        // see if the request is a JS file, and is a get request
        if (request.method() === "GET" && req_url.match(/https?:\/\/[a-z0-9:\._\-]+\/.+\.m?js\??.*/)) {
            js_urls_local.push(req_url);
        }

        // Only continue http/https requests — other schemes (mailto:, data:,
        // chrome-extension:, etc.) cannot be continued and will throw.
        if (req_url.match(/^https?:\/\//)) {
            await request.continue();
        } else {
            await request.abort();
        }
    });

    // Use networkidle0 so we capture all JS requests without waiting for the
    // app to finish rendering (deferred scripts executing can hang indefinitely
    // for some framework/bundler combinations). 10s is ample for localhost.
    try {
        await page.goto(url, { waitUntil: "networkidle0", timeout: 10000 });
    } catch (_) {
        // Navigation error or timeout — use whatever URLs were captured so far.
    }

    try {
        await browser.close();
    } catch (_) {
        // browser.close() can hang if Chrome is stuck. Force-kill as fallback.
        browser.process()?.kill("SIGKILL");
    }

    return js_urls_local;
};

export default downloadLoadedJs;
