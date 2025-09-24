import chalk from "chalk";
import * as cheerio from "cheerio";
import makeRequest from "../../utility/makeReq.js";
import puppeteer from "puppeteer";


/**
 * Checks if a webpage uses Next.js by iterating through all HTML tags and checking if any src, srcset, or imageSrcSet attribute value starts with "/_next/".
 * @returns {Promise<{detected: boolean, evidence: string}>}
 *   A promise that resolves to an object with two properties:
 *   - detected: A boolean indicating whether Next.js was detected.
 *   - evidence: A string with the evidence of the detection, or an empty string
 *     if Next.js was not detected.
 */
const checkNextJS = async ($) => {
    let detected = false;
    let evidence = "";
    // iterate through each HTML tag, and file tag value that starts with `/_next/`
    $("*").each((_, el) => {
        const tag = $(el).get(0).tagName;

        // check the value of three attributes
        const src = $(el).attr("src");
        const srcSet = $(el).attr("srcset");
        const imageSrcSet = $(el).attr("imageSrcSet");

        if (src || srcSet || imageSrcSet) {
            if (src && src.includes("/_next/")) {
                detected = true;
                evidence = `${tag} :: ${src}`;
            } else if (srcSet && srcSet.includes("/_next/")) {
                detected = true;
                evidence = `${tag} :: ${srcSet}`;
            } else if (imageSrcSet && imageSrcSet.includes("/_next/")) {
                detected = true;
                evidence = `${tag} :: ${imageSrcSet}`;
            }
        }
    });

    return { detected, evidence };
};



/**
 * Checks if a webpage uses Vue.js by iterating through all HTML tags and checking if any attribute name starts with "data-v-".
 * @returns {Promise<{detected: boolean, evidence: string}>}
 *   A promise that resolves to an object with two properties:
 *   - detected: A boolean indicating whether Vue.js was detected.
 *   - evidence: A string with the evidence of the detection, or an empty string
 *     if Vue.js was not detected.
 */
const checkVueJS = async ($) => {
    let detected = false;
    let evidence = "";

    $("*").each((_, el) => {
        const tag = $(el).get(0).tagName;
        const attribs = el.attribs;
        if (attribs) {
            for (const [attrName, attrValue] of Object.entries(attribs)) {
                if (attrName.startsWith("data-v-")) {
                    detected = true;
                    evidence = `${tag} :: ${attrName}`;
                }
            }
        }
    });

    return { detected, evidence };
};

/**
 * Detects if a webpage uses Nuxt.js by checking for "/_nuxt" paths in src or href attributes.
 * 
 * @param $ - The Cheerio API object containing the parsed HTML
 * @returns Promise that resolves to an object with detection status and evidence
 */
const checkNuxtJS = async ($: cheerio.CheerioAPI) => {
    let detected = false;
    let evidence = "";

    // go through the page source, and check for "/_nuxt" in the src or href attribute
    $("*").each((_, el) => {
        // @ts-ignore
        const tag = $(el).get(0).tagName;
        // @ts-ignore
        const attribs = el.attribs;
        if (attribs) {
            for (const [attrName, attrValue] of Object.entries(attribs)) {
                if (attrName === "src" || attrName === "href") {
                    // @ts-ignore
                    if (attrValue.includes("/_nuxt")) {
                        detected = true;
                        evidence = `${attrName} :: ${attrValue}`;
                    }
                }
            }
        }
    });

    return { detected, evidence };
};

/**
 * Detects if a webpage uses Svelte/SvelteKit by checking for Svelte-specific attributes.
 * 
 * Looks for svelte- prefixed class names, IDs, and SvelteKit-specific attributes
 * like data-sveltekit-reload to identify Svelte applications.
 * 
 * @param $ - The Cheerio API object containing the parsed HTML
 * @returns Promise that resolves to an object with detection status and evidence
 */
const checkSvelte = async ($) => {
    let detected = false;
    let evidence = "";

    // go through the page source, and check for all the class names of all HTML tags
    $("*").each((_, el) => {
        const tag = $(el).get(0).tagName;
        const attribs = el.attribs;
        if (attribs) {
            for (const [attrName, attrValue] of Object.entries(attribs)) {
                if (attrName === "class") {
                    // @ts-ignore
                    if (attrValue.includes("svelte-")) {
                        detected = true;
                        evidence = `${attrName} :: ${attrValue}`;
                    }
                }
            }
        }
    });

    // now, search for the svelte- id of all elements
    $("*").each((_, el) => {
        const tag = $(el).get(0).tagName;
        const attribs = el.attribs;
        if (attribs) {
            for (const [attrName, attrValue] of Object.entries(attribs)) {
                if (attrName === "id") {
                    // @ts-ignore
                    if (attrValue.includes("svelte-")) {
                        detected = true;
                        evidence = `${attrName} :: ${attrValue}`;
                    }
                }
            }
        }
    });

    // now, check for the data-sveltekit-reload attribute
    $("*").each((_, el) => {
        const tag = $(el).get(0).tagName;
        const attribs = el.attribs;
        if (attribs) {
            for (const [attrName, attrValue] of Object.entries(attribs)) {
                if (attrName === "data-sveltekit-reload") {
                    detected = true;
                    evidence = `${attrName} :: ${attrValue}`;
                }
            }
        }
    });

    return { detected, evidence };
};


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
const frameworkDetect = async (url: string) => {
    console.log(chalk.cyan("[i] Detecting front-end framework"));

    // get the page source
    const res = await makeRequest(url, {});

    // get the page source in the browser
    const browser = await puppeteer.launch({
        headless: true,
        args: process.env.IS_DOCKER === "true" ? ["--no-sandbox"] : [],
    });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    let pageSource = "";
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

    // if (res === null || res === undefined) {
    //   return;
    // }

    // const pageSource = await res.text();

    // cheerio to parse the page source
    const $ = cheerio.load(pageSource);

    // check all technologies one by one
    const result_checkNextJS = await checkNextJS($);
    const result_checkVueJS = await checkVueJS($);
    const result_checkSvelte = await checkSvelte($);

    // now, also check with the res response
    let result_checkNextJS_res = { detected: false, evidence: "" };
    let result_checkVueJS_res = { detected: false, evidence: "" };
    let result_checkSvelte_res = { detected: false, evidence: "" };
    let $res;
    // if network error was caused, then return
    if (res === null) {
        console.log(chalk.red("[!] Fetch request failed after retries"));
    } else {
        const resBody = await res.text();
        $res = cheerio.load(resBody);
        result_checkNextJS_res = await checkNextJS($res);
        result_checkVueJS_res = await checkVueJS($res);
        result_checkSvelte_res = await checkSvelte($res);
    }

    if (result_checkNextJS.detected === true || result_checkNextJS_res.detected === true) {
        const evidence =
            result_checkNextJS.evidence !== "" ? result_checkNextJS.evidence : result_checkNextJS_res.evidence;
        return { name: "next", evidence };
    } else if (result_checkVueJS.detected === true || result_checkVueJS_res.detected === true) {
        console.log(chalk.green("[✓] Vue.js detected"));
        console.log(chalk.cyan(`[i] Checking Nuxt.JS`), chalk.dim("(Nuxt.JS is built on Vue.js)"));
        const result_checkNuxtJS = await checkNuxtJS($);
        const result_checkNuxtJS_res = await checkNuxtJS($res);
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
    }

    return null;
};

export default frameworkDetect;
