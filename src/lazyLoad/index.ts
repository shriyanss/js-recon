import chalk from "chalk";
import fs from "fs";
import frameworkDetect from "./techDetect/index.js";
import CONFIG from "../globalConfig.js";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;
import { URL } from "url";
import makeRequest from "../utility/makeReq.js";
import * as cheerio from "cheerio";

// Next.js
import subsequentRequests from "./next_js/next_SubsequentRequests.js";
import next_getJSScript from "./next_js/next_GetJSScript.js";
import next_GetLazyResourcesWebpackJs from "./next_js/next_GetLazyResourcesWebpackJs.js";
import next_getLazyResourcesBuildManifestJs from "./next_js/next_GetLazyResourcesBuildManifestJs.js";
import { next_buildId_RSC } from "./next_js/next_buildId.js";

// Nuxt.js
import nuxt_getFromPageSource from "./nuxt_js/nuxt_getFromPageSource.js";
import nuxt_stringAnalysisJSFiles from "./nuxt_js/nuxt_stringAnalysisJSFiles.js";
import nuxt_astParse from "./nuxt_js/nuxt_astParse.js";

// Svelte
import svelte_getFromPageSource from "./svelte/svelte_getFromPageSource.js";
import svelte_stringAnalysisJSFiles from "./svelte/svelte_stringAnalysisJSFiles.js";

// Angular
import angular_getFromPageSource from "./angular/angular_getFromPageSource.js";
import angular_getFromMainJs from "./angular/angular_getFromMainJs.js";

// Vue
import vue_runtimeJs from "./vue/vue_RuntimeJs.js";
import vue_singleJsFileOnHome from "./vue/vue_SingleJsFileOnHome.js";

// generic
import downloadFiles from "./downloadFilesUtil.js";
import downloadLoadedJs from "./downloadLoadedJsUtil.js";

// import global vars
import * as lazyLoadGlobals from "./globals.js";
import * as globals from "../utility/globals.js";
import path from "path";

/**
 * Downloads the required JavaScript files for a given URL
 * @param {string} url The URL to download the JS files from
 * @param {string} output The output directory to store the downloaded JS files
 * @param {boolean} strictScope If true, then only download the JS files from the input URL domain
 * @param {string[]} inputScope The list of domains to download the JS files from
 * @param {number} threads The number of threads to use for downloading the JS files
 * @param {boolean} subsequentRequestsFlag If true, then also download the JS files from subsequent requests
 * @param {string} urlsFile The file containing the list of URLs to download the JS files from
 * @param {boolean} insecure If true, then disable SSL certificate verification
 * @returns {Promise<void>} A Promise that resolves when the download is complete
 */
const lazyLoad = async (
    url: string,
    output: string,
    strictScope: boolean,
    inputScope: [],
    threads: number,
    subsequentRequestsFlag: boolean,
    urlsFile: string,
    insecure: boolean,
    buildId: boolean
) => {
    console.log(chalk.cyan("[i] Loading 'Lazy Load' module"));

    if (globals.getDisableSandbox()) {
        console.log(chalk.yellow("[!] Browser sandbox disabled"));
    }

    if (insecure) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        console.log(chalk.yellow("[!] Running in insecure mode. SSL certificate verification disabled"));
    }

    // if cache enabled, check if the cache file exists or not. If no, then create a new one
    if (!globals.getDisableCache()) {
        if (!fs.existsSync(globals.getRespCacheFile())) {
            fs.writeFileSync(globals.getRespCacheFile(), "{}");
        }
    }

    let urls;

    // check if the url is file or a URL
    if (fs.existsSync(url)) {
        urls = fs.readFileSync(url, "utf8").split("\n");
        // remove the empty lines
        urls = urls.filter((url) => url.trim() !== "");
    } else if (url.match(/https?:\/\/[a-zA-Z0-9\-_\.:]+/)) {
        urls = [url];
    } else {
        console.log(chalk.red("[!] Invalid URL or file path"));
        process.exit(3);
    }

    for (const url of urls) {
        console.log(chalk.cyan(`[i] Processing ${url}`));

        if (strictScope) {
            lazyLoadGlobals.pushToScope(new URL(url).host);
        } else {
            lazyLoadGlobals.setScope(inputScope);
        }

        lazyLoadGlobals.setMaxReqQueue(threads);

        const tech = await frameworkDetect(url);
        globals.setTech(tech ? tech.name : "");

        if (tech) {
            if (tech.name === "next") {
                console.log(chalk.green("[✓] Next.js detected"));
                console.log(chalk.yellow(`Evidence: ${tech.evidence}`));

                // find the JS files from script of the webpage
                const jsFilesFromScriptTag = await next_getJSScript(url);

                // get lazy resources
                const lazyResourcesFromWebpack = await next_GetLazyResourcesWebpackJs(url);
                const lazyResourcesFromBuildManifest = await next_getLazyResourcesBuildManifestJs(url);
                let lazyResourcesFromSubsequentRequests;

                if (subsequentRequestsFlag) {
                    // get JS files from subsequent requests
                    lazyResourcesFromSubsequentRequests = await subsequentRequests(
                        url,
                        urlsFile,
                        threads,
                        output,
                        lazyLoadGlobals.getJsUrls() // Pass the global js_urls
                    );
                }

                // download the resources
                // but combine them first
                let jsFilesToDownload: string[] | any = [
                    ...(jsFilesFromScriptTag || []),
                    ...(lazyResourcesFromWebpack || []),
                    ...(lazyResourcesFromBuildManifest || []),
                    ...(lazyResourcesFromSubsequentRequests || []),
                ];
                // Ensure js_urls from globals are included if next_getJSScript or next_getLazyResources populated it.
                // This is because those functions now push to the global js_urls via setters.
                // The return values of next_getJSScript and next_getLazyResources might be the same array instance
                // or a new one depending on their implementation, so explicitly get the global one here.
                jsFilesToDownload.push(...lazyLoadGlobals.getJsUrls());

                // also, download the JSON files, so push those as well into this list
                jsFilesToDownload.push(...lazyLoadGlobals.getJsonUrls());

                // dedupe the files
                jsFilesToDownload = [...new Set(jsFilesToDownload)];

                await downloadFiles(jsFilesToDownload, output);

                if (buildId) {
                    // get the buildId
                    // the directory is the output <output>/<host.replace(":", "_")>/___subsequent_requests
                    const buildId = await next_buildId_RSC(
                        output + "/" + new URL(url).host.replace(":", "_") + "/___subsequent_requests"
                    );

                    if (buildId) {
                        console.log(chalk.cyan("[+] Found buildId: " + buildId));
                        // now, write it to a file
                        fs.writeFileSync(path.join(output, new URL(url).host.replace(":", "_") + "/BUILD_ID"), buildId);
                    }
                }
            } else if (tech.name === "vue") {
                console.log(chalk.green("[✓] Vue.js detected"));
                console.log(chalk.yellow(`Evidence: ${tech.evidence}`));

                let jsFilesToDownload:string[] = [];



                // according to the vibe-coded app with a few pages, there are
                // just a few files, like 2-3, but that's not the case in prod

                // okay, found something from real apps :/
                // maybe vibes aren't enough xD

                // method 1: through runtime.<hash>.js 

                // for this, first get the contents of `/`, and find runtime.<hash>.js file


                /* ==========================
                 *  IMPORTANT: THE FOLLOWING MODULE IS INCOMPLETE
                 *  JUST NEED TO COMPLETE IT
                 *  DO NOT PERMANENTLY DELETE IT
                 * ========================== 
                 */
                // const runtimeJsFiles = await vue_runtimeJs(url);
                // jsFilesToDownload.push(...runtimeJsFiles);

                
                // another method: this is when the application only loads a single JS file
                // everything is there right in that file

                const jsFilesFromSingleJsFile = await vue_singleJsFileOnHome(url);
                jsFilesToDownload.push(...jsFilesFromSingleJsFile);
                if (jsFilesFromSingleJsFile.length > 0) {
                    console.log(chalk.green(`[✓] Found ${jsFilesFromSingleJsFile.length} files from the single JS file on home`));
                }

                // now, get the import statements from the JS files
                

            } else if (tech.name === "nuxt") {
                console.log(chalk.green("[✓] Nuxt.js detected"));
                console.log(chalk.yellow(`Evidence: ${tech.evidence}`));

                let jsFilesToDownload: string[] = [];

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
            } else if (tech.name === "angular") {
                console.log(chalk.green("[✓] Angular detected"));
                console.log(chalk.yellow(`Evidence: ${tech.evidence}`));

                let jsFilesToDownload = [];

                // find the files from the page source
                const jsFilesFromPageSource = await angular_getFromPageSource(url);
                jsFilesToDownload.push(...jsFilesFromPageSource);

                // files using the main.js
                let mainJsUrl: string | undefined;
                for (const jsFile of jsFilesToDownload) {
                    if (jsFile.match(/main[a-zA-Z0-9\-]*\.js/)) {
                        mainJsUrl = jsFile;
                        break;
                    }
                }

                if (mainJsUrl) {
                    const jsFilesFromMainJs = await angular_getFromMainJs(mainJsUrl);
                    jsFilesToDownload.push(...jsFilesFromMainJs);
                }

                // dedupe the files
                jsFilesToDownload = [...new Set(jsFilesToDownload)];

                await downloadFiles(jsFilesToDownload, output);
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
    }
};

export default lazyLoad;
