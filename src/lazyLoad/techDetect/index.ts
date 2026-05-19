import chalk from "chalk";
import * as cheerio from "cheerio";
import makeRequest from "../../utility/makeReq.js";
import puppeteer from "../../utility/puppeteerInstance.js";
import * as globalsUtil from "../../utility/globals.js";
import path from "path";
import { checkNextJS } from "./checkNextJS.js";
import { checkNuxtJS } from "./checkNuxtJS.js";
import { checkSvelte } from "./checkSvelte.js";
import { checkVueJS } from "./checkVueJS.js";
import { checkAngularJS } from "./checkAngularJS.js";
import { checkReact } from "./checkReact.js";

/**
 * Detects the front-end framework used in a webpage.
 * It does this by iterating through all HTML tags and checking if any attribute name starts with "data-v-".
 * It also checks for Nuxt.js by checking for "/_nuxt" paths in src or href attributes.
 * It also checks for SvelteKit-specific attributes
 * @param {string} url - The URL of the webpage to fetch and parse.
 * @returns {Promise<{name: string, evidence: string}>} - A promise that resolves to an object with two properties:
 *   - name: The name of the detected front-end framework.
 *   - evidence: A string with the evidence of the detection, or an empty string if no front-end framework was detected.
 */
const frameworkDetect = async (url: string): Promise<{ name: string; evidence: string }> => {
    console.log(chalk.cyan("[i] Detecting front-end framework"));

    // get the page source. Drain the body immediately into a string — if we
    // wait until after the puppeteer + downstream check* calls, the Response
    // body gets invalidated (undici flips bodyUsed=true mid-flight when the
    // response is held idle alongside other in-flight fetches).
    const res = await makeRequest(url, {});
    let resBody: string | null = null;
    if (res !== null) {
        try {
            resBody = await res.text();
        } catch (err) {
            console.log(
                chalk.yellow(
                    `[!] Could not read fetch response body for ${url} (${(err as any)?.message || err}); using browser-rendered source only.`
                )
            );
        }
    }

    // get the page source in the browser (skipped in cache-only mode — no network allowed)
    let pageSource = "";
    if (!globalsUtil.getCacheOnly()) {
        const browser = await puppeteer.launch({
            args: globalsUtil.getDisableSandbox() ? ["--no-sandbox", "--disable-setuid-sandbox"] : [],
        });
        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(30000);
        try {
            await page.goto(url, {
                waitUntil: "domcontentloaded",
                timeout: 30000,
            });
            // Give client-side frameworks a brief window to render
            await page.waitForSelector("html", { timeout: 10000 }).catch(() => {});
            await new Promise((resolve) => setTimeout(resolve, 2000));
            pageSource = await page.content();
        } catch (err) {
            console.log(chalk.yellow("[!] Page navigation/content failed, falling back to fetch response if available"));
        } finally {
            await browser.close().catch(() => {});
        }
    }

    // if (res === null || res === undefined) {
    //   return;
    // }

    // const pageSource = await res.text();

    // cheerio to parse the page source
    const $ = cheerio.load(pageSource);

    // there are two checks
    // one is directly on the response the tool gets by making request with fetch ($)
    // and the second one is by opening the page in browser, loading content, and then analyzing the page content ($res)

    // check all technologies one by one
    const result_checkNextJS = await checkNextJS($);
    const result_checkVueJS = await checkVueJS($, url);
    const result_checkSvelte = await checkSvelte($);
    const result_checkAngular = await checkAngularJS($, url);
    const result_checkReact = await checkReact($, url);

    // now, also check with the res response
    let result_checkNextJS_res = { detected: false, evidence: "" };
    let result_checkVueJS_res = { detected: false, evidence: "" };
    let result_checkSvelte_res = { detected: false, evidence: "" };
    let result_checkAngularJS_res = { detected: false, evidence: "" };
    let result_checkReact_res = { detected: false, evidence: "" };

    let $res;
    // if network error was caused, then return
    if (res === null) {
        console.log(chalk.red("[!] Fetch request failed after retries"));
    } else if (resBody !== null) {
        $res = cheerio.load(resBody);
        result_checkNextJS_res = await checkNextJS($res);
        result_checkVueJS_res = await checkVueJS($res, url);
        result_checkSvelte_res = await checkSvelte($res);
        result_checkAngularJS_res = await checkAngularJS($res, url);
        result_checkReact_res = await checkReact($res, url);
    }

    if (result_checkNextJS.detected === true || result_checkNextJS_res.detected === true) {
        const evidence =
            result_checkNextJS.evidence !== "" ? result_checkNextJS.evidence : result_checkNextJS_res.evidence;
        return { name: "next", evidence };
    } else if (result_checkVueJS.detected === true || result_checkVueJS_res.detected === true) {
        console.log(chalk.green("[✓] Vue.js detected"));
        console.log(chalk.cyan(`[i] Checking Nuxt.JS`), chalk.dim("(Nuxt.JS is built on Vue.js)"));
        const result_checkNuxtJS = await checkNuxtJS($);
        const result_checkNuxtJS_res = $res ? await checkNuxtJS($res) : { detected: false, evidence: "" };
        if (result_checkNuxtJS.detected === true || result_checkNuxtJS_res.detected === true) {
            const evidence =
                result_checkNuxtJS.evidence !== "" ? result_checkNuxtJS.evidence : result_checkNuxtJS_res.evidence;
            return { name: "nuxt", evidence };
        }
        const evidence =
            result_checkVueJS.evidence !== "" ? result_checkVueJS.evidence : result_checkVueJS_res.evidence;
        return { name: "vue", evidence };
    } else if (result_checkSvelte.detected === true || result_checkSvelte_res.detected === true) {
        const evidence =
            result_checkSvelte.evidence !== "" ? result_checkSvelte.evidence : result_checkSvelte_res.evidence;
        return { name: "svelte", evidence };
    } else if (result_checkAngular.detected === true || result_checkAngularJS_res.detected === true) {
        const evidence =
            result_checkAngular.evidence !== "" ? result_checkAngular.evidence : result_checkAngularJS_res.evidence;
        return { name: "angular", evidence };
    } else if (result_checkReact.detected === true || result_checkReact_res.detected === true) {
        const evidence =
            result_checkReact.evidence !== "" ? result_checkReact.evidence : result_checkReact_res.evidence;
        return { name: "react", evidence };
    }

    return null;
};

export default frameworkDetect;
