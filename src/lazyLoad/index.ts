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
import NextJsCrawler from "./next_js/NextJsCrawler.js";
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
import vue_discoverJsFiles from "./vue/vue_discoverJsFiles.js";
import vue_recursiveClientSidePathDownload from "./vue/vue_recursiveClientSidePathDownload.js";

// generic
import downloadFiles from "./downloadFilesUtil.js";
import downloadLoadedJs from "./downloadLoadedJsUtil.js";

// for rebuilding source maps
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { join, dirname } from "path";
import { extractSources } from "./sourcemap.js";

// import global vars
import * as lazyLoadGlobals from "./globals.js";
import * as globals from "../utility/globals.js";

const getMapFilesRecursively = (dir: string): string[] => {
    const entries = readdirSync(dir, { withFileTypes: true });
    const mapFiles: string[] = [];

    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            mapFiles.push(...getMapFilesRecursively(fullPath));
        } else if (entry.isFile() && entry.name.endsWith(".js.map")) {
            mapFiles.push(fullPath);
        }
    }

    return mapFiles;
};

/**
 * Extracts the source maps from a given directory and writes the original source files to an output directory.
 * @param {string} assetsDir The directory containing the source maps (.js.map files)
 * @param {string} outputDir The directory to write the extracted source files
 * @returns {Promise<void>}
 */
const extractSourceMaps = async (assetsDir: string, outputDir: string) => {
    const mapFiles = getMapFilesRecursively(assetsDir);
    let counter = 0;

    for (const mapFile of mapFiles) {
        // read the file while skipping the first line
        const mapContent = readFileSync(mapFile, "utf-8").split("\n").slice(1).join("\n");
        const { files } = extractSources(mapContent);

        for (const file of files) {
            const outPath = join(outputDir, file.path);
            mkdirSync(dirname(outPath), { recursive: true });
            writeFileSync(outPath, file.content);
            counter++;
        }
    }

    if (counter !== 0) {
        console.log(chalk.green(`[✓] Found ${counter} files from source maps - written to ${outputDir}`));
    }
};

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
    buildId: boolean,
    sourcemapDir: string,
    research: boolean,
    researchOutput: string,
    maxIterations: number,
    maxJsSizeMb: number = 2
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

                const crawler = new NextJsCrawler({
                    url,
                    output,
                    subsequentRequestsFlag,
                    urlsFile,
                    threads,
                    research,
                    maxIterations,
                });

                const jsFilesToDownload = await crawler.crawl();

                // dedupe the files
                const dedupedFiles = [...new Set(jsFilesToDownload)];
                await downloadFiles(dedupedFiles, output);

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

                // if the research mode is enabled, then write the technique efficiency to a file
                if (research) {
                    // prettify the JSON and write
                    fs.writeFileSync(researchOutput, JSON.stringify(crawler.techniqueEfficiencyMapping, null, 4));
                    console.log(
                        chalk.green("[✓] Research mode enabled. Technique efficiency written to " + researchOutput)
                    );
                }

                // extract the source maps
                await extractSourceMaps(output, sourcemapDir);
            } else if (tech.name === "vue") {
                console.log(chalk.green("[✓] Vue.js detected"));
                console.log(chalk.yellow(`Evidence: ${tech.evidence}`));

                // run the full discovery pipeline against the entry URL
                const { jsFiles, clientSidePaths } = await vue_discoverJsFiles(url, maxJsSizeMb);

                // recurse the same pipeline through every client-side path we found
                const recursivelyDiscovered = await vue_recursiveClientSidePathDownload(
                    clientSidePaths,
                    threads,
                    maxJsSizeMb
                );

                const jsFilesToDownload = [...new Set([...jsFiles, ...recursivelyDiscovered])];

                // finally, download these
                await downloadFiles(jsFilesToDownload, output);

                // extract the source maps
                await extractSourceMaps(output, sourcemapDir);
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
            } else if (tech.name === "react") {
                console.log(chalk.green("[✓] React detected"));
                console.log(chalk.yellow(`Evidence: ${tech.evidence}`));
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
