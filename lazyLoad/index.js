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
import nuxt_astParse from "./nuxt_js/nuxt_astParse.js";

// Svelte
import svelte_getFromPageSource from "./svelte/svelte_getFromPageSource.js";
import svelte_stringAnalysisJSFiles from "./svelte/svelte_stringAnalysisJSFiles.js";

// generic
import downloadFiles from "./downloadFilesUtil.js";
import downloadLoadedJs from "./downloadLoadedJsUtil.js";

// import global vars
import * as lazyLoadGlobals from "./globals.js";
import * as globals from "../utility/globals.js";

/**
 * Downloads all lazy-loaded JavaScript files from the specified URL or file containing URLs.
 *
 * The function detects the JavaScript framework used by the webpage (e.g., Next.js, Nuxt.js)
 * and utilizes specific techniques to find and download lazy-loaded JS files.
 * It supports subsequent requests for additional JS files if specified.
 *
 * @param {string} url - The URL or path to a file containing a list of URLs to process.
 * @param {string} output - The directory where downloaded files will be saved.
 * @param {boolean} strictScope - Whether to restrict downloads to the input URL domain.
 * @param {string[]} inputScope - Specific domains to download JS files from.
 * @param {number} threads - The number of threads to use for downloading files.
 * @param {boolean} subsequentRequestsFlag - Whether to include JS files from subsequent requests.
 * @param {string} urlsFile - The JSON file containing additional URLs for subsequent requests.
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

  // if cache enabled, check if the cache file exists or not. If no, then create a new one
  if (!globals.getDisableCache()) {
    if (!fs.existsSync(globals.getRespCacheFile())) {
      fs.writeFileSync(globals.getRespCacheFile(), "{}");
    }
  }

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
      lazyLoadGlobals.pushToScope(new URL(url).host);
    } else {
      lazyLoadGlobals.setScope(inputScope);
    }

    lazyLoadGlobals.setMaxReqQueue(threads);
    lazyLoadGlobals.clearJsUrls(); // Initialize js_urls for each URL processing in the loop

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
            lazyLoadGlobals.getJsUrls(), // Pass the global js_urls
          );
        }

        // download the resources
        // but combine them first
        let jsFilesToDownload = [
          ...(jsFilesFromScriptTag || []),
          ...(lazyResourcesFromWebpack || []),
          ...(lazyResourcesFromSubsequentRequests || []),
        ];
        // Ensure js_urls from globals are included if next_getJSScript or next_getLazyResources populated it.
        // This is because those functions now push to the global js_urls via setters.
        // The return values of next_getJSScript and next_getLazyResources might be the same array instance
        // or a new one depending on their implementation, so explicitly get the global one here.
        jsFilesToDownload.push(...lazyLoadGlobals.getJsUrls());

        // dedupe the files
        jsFilesToDownload = [...new Set(jsFilesToDownload)];

        await downloadFiles(jsFilesToDownload, output);
      } else if (tech.name === "vue") {
        console.log(chalk.green("[✓] Vue.js detected"));
        console.log(chalk.yellow(`Evidence: ${tech.evidence}`));
      } else if (tech.name === "nuxt") {
        console.log(chalk.green("[✓] Nuxt.js detected"));
        console.log(chalk.yellow(`Evidence: ${tech.evidence}`));

        let jsFilesToDownload = [];

        // find the files from the page source
        const jsFilesFromPageSource = await nuxt_getFromPageSource(url);
        const jsFilesFromStringAnalysis = await nuxt_stringAnalysisJSFiles(url);

        jsFilesToDownload.push(...jsFilesFromPageSource);
        jsFilesToDownload.push(...jsFilesFromStringAnalysis);
        // dedupe the files
        jsFilesToDownload = [...new Set(jsFilesToDownload)];

        let jsFilesFromAST = [];
        console.log(chalk.cyan("[i] Analyzing functions in the files found"));
        for (const jsFile of jsFilesToDownload) {
          jsFilesFromAST.push(...(await nuxt_astParse(jsFile)));
        }

        jsFilesToDownload.push(...jsFilesFromAST);

        jsFilesToDownload.push(...lazyLoadGlobals.getJsUrls());

        // dedupe the files
        jsFilesToDownload = [...new Set(jsFilesToDownload)];

        await downloadFiles(jsFilesToDownload, output);
      } else if (tech.name === "svelte") {
        console.log(chalk.green("[✓] Svelte detected"));
        console.log(chalk.yellow(`Evidence: ${tech.evidence}`));

        let jsFilesToDownload = [];

        // find the files from the page source
        const jsFilesFromPageSource = await svelte_getFromPageSource(url);
        jsFilesToDownload.push(...jsFilesFromPageSource);

        // analyze the strings now
        const jsFilesFromStringAnalysis = await svelte_stringAnalysisJSFiles(url);
        jsFilesToDownload.push(...jsFilesFromStringAnalysis);

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
