import chalk from "chalk";
import fs from "fs";
import frameworkDetect from "../techDetect/index.js";
import CONFIG from "../globalConfig.js";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;
import { URL } from "url";


// Next.js
import subsequentRequests from "./next_js/next_SubsequentRequests.js";
import next_getJSScript from "./next_js/next_GetJSScript.js";
import next_getLazyResources from "./next_js/next_GetLazyResources.js";

// Nuxt.js
import nuxt_getFromPageSource from "./nuxt_js/nuxt_getFromPageSource.js";
import nuxt_stringAnalysisJSFiles from "./nuxt_js/nuxt_stringAnalysisJSFiles.js";

// generic
import downloadFiles from "./downloadFilesUtil.js";
import downloadLoadedJs from "./downloadLoadedJsUtil.js";


// import global vars
import * as globals from "./globals.js";


/**
 * Downloads all the lazy loaded JS files from a given URL.
 * It detects Next.js by looking for the presence of a webpack JS file
 * and uses the following techniques to find the lazy loaded files:
 * 1. Finds the webpack JS file by looking for a script tag with a src
 *    attribute that starts with "/next/". This is done by iterating through
 *    all script tags and checking the src attribute.
 * 2. Parses the webpack JS file to find functions that end with ".js". These
 *    functions are assumed to return the path of the lazy loaded JS file.
 * 3. Iterates through all integers, till 1000000, and passes it to the found
 *    function to get the output. If the output does not include "undefined",
 *    it is added to the list of lazy loaded files.
 * 4. Downloads the lazy loaded files and saves them as files in the specified
 *    output directory.
 * @param {string} url - The URL to be processed.
 * @param {string} output - The directory where the downloaded files will be saved.
 * @returns {Promise<void>}
 */
const lazyLoad = async (
  url,
  output,
  strictScope,
  inputScope,
  threads,
  subsequentRequestsFlag,
  urlsFile,
) => {
  console.log(chalk.cyan("[i] Loading 'Lazy Load' module"));

  let urls;

  // check if the url is file or a URL
  if (fs.existsSync(url)) {
    urls = fs.readFileSync(url, "utf-8").split("\n");
    // remove the empty lines
    urls = urls.filter((url) => url.trim() !== "");
  } else if (url.match(/https?:\/\/[a-zA-Z0-9\-_\.:]+/)) {
    urls = [url];
  } else {
    console.log(chalk.red("[!] Invalid URL or file path"));
    return;
  }

  for (const url of urls) {
    console.log(chalk.cyan(`[i] Processing ${url}`));

    if (strictScope) {
      globals.pushToScope(new URL(url).host);
    } else {
      globals.setScope(inputScope);
    }

    globals.setMaxReqQueue(threads);
    globals.clearJsUrls(); // Initialize js_urls for each URL processing in the loop


    const tech = await frameworkDetect(url);

    if (tech) {
      if (tech.name === "next") {
        console.log(chalk.green("[✓] Next.js detected"));
        console.log(chalk.yellow(`Evidence: ${tech.evidence}`));

        // find the JS files from script of the webpage
        const jsFilesFromScriptTag = await next_getJSScript(url);

        // get lazy resources
        const lazyResourcesFromWebpack = await next_getLazyResources(url);
        let lazyResourcesFromSubsequentRequests;

        if (subsequentRequestsFlag) {
          // get JS files from subsequent requests
          lazyResourcesFromSubsequentRequests = await subsequentRequests(
            url,
            urlsFile,
            threads,
            output,
            globals.getJsUrls() // Pass the global js_urls
          );
        }

        // download the resources
        // but combine them first
        let jsFilesToDownload = [...(jsFilesFromScriptTag || []), ...(lazyResourcesFromWebpack || []), ...(lazyResourcesFromSubsequentRequests || [])];
        // Ensure js_urls from globals are included if next_getJSScript or next_getLazyResources populated it.
        // This is because those functions now push to the global js_urls via setters.
        // The return values of next_getJSScript and next_getLazyResources might be the same array instance
        // or a new one depending on their implementation, so explicitly get the global one here.
        jsFilesToDownload.push(...globals.getJsUrls());

        // dedupe the files
        jsFilesToDownload = [...new Set(jsFilesToDownload)];

        await downloadFiles(jsFilesToDownload, output);
      }
      else if (tech.name === "vue") {
        console.log(chalk.green("[✓] Vue.js detected"));
        console.log(chalk.yellow(`Evidence: ${tech.evidence}`));
      }
      else if (tech.name === "nuxt") {
        console.log(chalk.green("[✓] Nuxt.js detected"));
        console.log(chalk.yellow(`Evidence: ${tech.evidence}`));

        // find the files from the page source
        const jsFilesFromPageSource = await nuxt_getFromPageSource(url);
        const jsFilesFromStringAnalysis = await nuxt_stringAnalysisJSFiles(url);

        let jsFilesToDownload = [...(jsFilesFromPageSource || []), ...(jsFilesFromStringAnalysis || [])];

        jsFilesToDownload.push(...globals.getJsUrls());

        // dedupe the files
        jsFilesToDownload = [...new Set(jsFilesToDownload)];

        await downloadFiles(jsFilesToDownload, output);
      }
    } else {
      console.log(chalk.red("[!] Framework not detected :("));
      console.log(chalk.magenta(CONFIG.notFoundMessage));
      console.log(chalk.yellow("[i] Trying to download loaded JS files"));
      const js_urls = await downloadLoadedJs(url);
      if (js_urls && js_urls.length > 0) {
        console.log(chalk.green(`[✓] Found ${js_urls.length} JS chunks`));
        await downloadFiles(js_urls, output);
      }
    }
  }
};

export default lazyLoad;
