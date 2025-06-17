import chalk from "chalk";
import * as cheerio from "cheerio";
import makeRequest from "../utility/makeReq.js";
import puppeteer from "puppeteer";

/**
 * Detects if a webpage uses Next.js by checking if any HTML tag has a src,
 * srcset, or imageSrcSet attribute that starts with "/_next/".
 * @param {CheerioStatic} $ - The Cheerio object containing the parsed HTML.
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
      if (src && src.startsWith("/_next/")) {
        detected = true;
        evidence = `${tag} :: ${src}`;
      } else if (srcSet && srcSet.startsWith("/_next/")) {
        detected = true;
        evidence = `${tag} :: ${srcSet}`;
      } else if (imageSrcSet && imageSrcSet.startsWith("/_next/")) {
        detected = true;
        evidence = `${tag} :: ${imageSrcSet}`;
      }
    }
  });

  return { detected, evidence };
};

/**
 * Detects if a webpage uses Vue.js by checking if any HTML tag has a data-v-* attribute.
 * @param {CheerioStatic} $ - The Cheerio object containing the parsed HTML.
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
 * Detects the front-end framework used by a webpage.
 * @param {string} url - The URL of the webpage to be detected.
 * @returns {Promise<{name: string, evidence: string}> | null}
 *   A promise that resolves to an object with two properties:
 *   - name: A string indicating the detected framework, or null if no framework was detected.
 *   - evidence: A string with the evidence of the detection, or an empty string if no framework was detected.
 */
const frameworkDetect = async (url) => {
  console.log(chalk.cyan("[i] Detecting front-end framework"));

  // get the page source
  const res = await makeRequest(url);

  // get the page source in the browser
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-setuid-sandbox",
      "--no-sandbox",
    ],
  });
  const page = await browser.newPage();
  await page.goto(url);
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const pageSource = await page.content();
  await browser.close();

  // if (res === null || res === undefined) {
  //   return;
  // }

  // const pageSource = await res.text();

  // cheerio to parse the page source
  const $ = cheerio.load(pageSource);

  // check all technologies one by one
  const result_checkNextJS = await checkNextJS($);
  const result_checkVueJS = await checkVueJS($);

  if (result_checkNextJS.detected === true) {
    return { name: "next", evidence: result_checkNextJS.evidence };
  } else if (result_checkVueJS.detected === true) {
    return { name: "vue", evidence: result_checkVueJS.evidence };
  }

  return null;
};

export default frameworkDetect;
