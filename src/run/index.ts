import endpoints from "../endpoints/index.js";
import strings from "../strings/index.js";
import map from "../map/index.js";
import * as globalsUtil from "../utility/globals.js";
import * as fs from "fs";
import lazyLoad from "../lazyLoad/index.js";
import chalk from "chalk";
import CONFIG from "../globalConfig.js";
import analyze from "../analyze/index.js";
import report from "../report/index.js";
import { clearJsUrls, clearJsonUrls, getJsUrls } from "../lazyLoad/globals.js";
import path from "path";

/**
 * Determines the directory for a Content Delivery Network (CDN) if used by the target.
 *
 * Checks if any of the downloaded JavaScript files are from a different host, which
 * indicates a CDN is in use. This is important for modules that rely on code analysis.
 *
 * @param host - The host of the target URL
 * @param outputDir - The base output directory
 * @returns Promise that resolves to the path of the CDN directory or undefined if no CDN is detected
 */
const getCdnDir = async (host: string, outputDir: string): Promise<string | undefined> => {
    // get the JS URLs
    let cdnDir: string | undefined;
    for (const url of getJsUrls()) {
        if (url.includes("_next/static/chunks")) {
            // check if the host and url.host match
            const urlHostDir = new URL(url).host.replace(":", "_"); // e.g. example.com_8443
            const urlHost = new URL(url).host; // e.g. example.com:8443
            const initialHost = new URL(host).host; // e.g. example.com:443
            if (urlHost !== initialHost) {
                cdnDir = path.join(outputDir, urlHostDir);
                break;
            }
        }
    }
    return cdnDir;
};

/**
 * Processes a single URL through the entire js-recon analysis pipeline.
 *
 * This function orchestrates the execution of all modules in sequence:
 * 1. Lazyload - Downloads JavaScript files
 * 2. Strings - Extracts endpoints and secrets
 * 3. Map - Analyzes functions and generates mappings
 * 4. Endpoints - Extracts client-side endpoints
 * 5. Analyze - Runs security analysis rules
 * 6. Report - Generates final analysis report
 *
 * @param url - The URL to analyze
 * @param outputDir - The directory for downloaded content (e.g., JS files)
 * @param workingDir - The directory for storing analysis results and reports
 * @param cmd - The command-line options object
 * @param isBatch - Whether this is part of a batch process, affecting file path resolution
 * @returns Promise that resolves when the analysis for the URL is complete
 */
const processUrl = async (
    url: string,
    outputDir: string,
    workingDir: string,
    cmd: any,
    isBatch: boolean
): Promise<void> => {
    const targetHost = new URL(url).host.replace(":", "_");

    console.log(chalk.bgGreenBright(`[+] Starting analysis for ${url}...`));

    if (isBatch) {
        clearJsUrls();
        clearJsonUrls();
    }

    console.log(chalk.bgCyan("[1/8] Running lazyload to download JavaScript files..."));
    await lazyLoad(url, outputDir, cmd.strictScope, cmd.scope.split(","), cmd.threads, false, "", cmd.insecure, false, cmd.sourcemapDir);
    console.log(chalk.bgGreen("[+] Lazyload complete."));

    if (globalsUtil.getTech() === "") {
        console.log(chalk.bgRed(`[!] Technology not detected. ${isBatch ? "Skipping this target." : "Quitting."}`));
        if (isBatch) {
            return;
        }
        process.exit(10);
    }

    if (!["next"].includes(globalsUtil.getTech())) {
        console.log(
            chalk.bgYellow(
                `[!] The tool only supports Next.JS ('next') fully. For ${globalsUtil.getTech()}, only downloading JS files is supported`
            )
        );
        return;
    }

    const stringsFile = isBatch ? `${workingDir}/strings.json` : "strings.json";
    const extractedUrlsFile = isBatch ? `${workingDir}/extracted_urls` : "extracted_urls";
    const mappedFile = isBatch ? `${workingDir}/mapped` : "mapped";
    const mappedJsonFile = isBatch ? `${workingDir}/mapped.json` : "mapped.json";
    const endpointsFile = isBatch ? `${workingDir}/endpoints` : "endpoints";
    const openapiFile = isBatch ? `${workingDir}/mapped-openapi.json` : "mapped-openapi.json";
    const analyzeFile = isBatch ? `${workingDir}/analyze.json` : "analyze.json";
    const reportDbFile = isBatch ? `${workingDir}/js-recon.db` : "js-recon.db";
    const reportFile = isBatch ? `${workingDir}/report` : "report";

    // if the target is using a CDN, then just passing the outputDir/host won't work, and would throw an error.
    // So, if the target was found to be using a CDN, scan the CDN directory rather than the outputDir/host
    // One IMPORTANT thing: this is only meant for modules that rely on just the code (map)
    const cdnDir = await getCdnDir(url, outputDir);
    const cdnOutputDir = cdnDir ? cdnDir : outputDir + "/" + targetHost;

    console.log(chalk.bgCyan("[2/8] Running strings to extract endpoints..."));
    await strings(outputDir, stringsFile, true, extractedUrlsFile, false, false, false);
    console.log(chalk.bgGreen("[+] Strings complete."));

    console.log(chalk.bgCyan("[3/8] Running lazyload with subsequent requests to download JavaScript files..."));
    await lazyLoad(
        url,
        outputDir,
        cmd.strictScope,
        cmd.scope.split(","),
        cmd.threads,
        true,
        `${extractedUrlsFile}.json`,
        cmd.insecure,
        true,
        cmd.sourcemapDir
    );
    console.log(chalk.bgGreen("[+] Lazyload with subsequent requests complete."));

    console.log(chalk.bgCyan("[4/8] Running strings again to extract endpoints..."));
    await strings(outputDir, stringsFile, true, extractedUrlsFile, cmd.secrets, true, true);
    console.log(chalk.bgGreen("[+] Strings complete."));

    console.log(chalk.bgCyan("[5/8] Running map to find functions..."));
    globalsUtil.setOpenapi(true);
    if (isBatch) {
        globalsUtil.setOpenapiOutputFile(openapiFile);
    }
    await map(cdnOutputDir, mappedFile, ["json"], globalsUtil.getTech(), false, false);
    console.log(chalk.bgGreen("[+] Map complete."));

    console.log(chalk.bgCyan("[6/8] Running endpoints to extract endpoints..."));
    if (fs.existsSync(`${outputDir}/${targetHost}/___subsequent_requests`)) {
        await endpoints(url, `${outputDir}/${targetHost}/`, endpointsFile, ["json"], "next", false, mappedJsonFile);
    } else {
        await endpoints(url, undefined, endpointsFile, ["json"], "next", false, mappedJsonFile);
    }
    console.log(chalk.bgGreen("[+] Endpoints complete."));

    console.log(chalk.bgCyan("[7/8] Running analyze to extract endpoints..."));
    // @ts-ignore
    await analyze("", mappedJsonFile, globalsUtil.getTech(), false, openapiFile, false, analyzeFile);
    console.log(chalk.bgGreen("[+] Analyze complete."));

    console.log(chalk.bgCyan("[8/8] Running report module..."));
    await report(reportDbFile, mappedJsonFile, analyzeFile, `${endpointsFile}.json`, openapiFile, reportFile);
    console.log(chalk.bgGreen("[+] Report complete."));

    console.log(chalk.bgGreenBright(`[+] Analysis complete for ${url}.`));
};

/**
 * Main handler for the 'run' command that executes the complete js-recon analysis pipeline.
 *
 * Sets up global configuration and determines whether to process a single URL or
 * a file containing multiple URLs. For batch processing, creates organized directory
 * structure and processes each URL sequentially.
 *
 * @param cmd - The command-line options object from commander.js
 * @returns Promise that resolves when all URL processing is complete
 */
export default async (cmd: any): Promise<void> => {
    globalsUtil.setApiGatewayConfigFile(cmd.apiGatewayConfig);
    globalsUtil.setUseApiGateway(cmd.apiGateway);
    globalsUtil.setDisableCache(cmd.disableCache);
    globalsUtil.setRespCacheFile(cmd.cacheFile);
    globalsUtil.setYes(cmd.yes);

    // check if the given URL is a file
    if (!fs.existsSync(cmd.url)) {
        // check if output directory exists. If so, ask the user to switch to other directory
        // if not done, it might conflict this process
        // for devs: run `npm run cleanup` to prepare this directory
        if (fs.existsSync(cmd.output)) {
            console.log(
                chalk.red(
                    `[!] Output directory ${cmd.output} already exists. Please switch to other directory or it might conflict with this process.`
                )
            );
            console.log(
                chalk.yellow(
                    `[i] For advanced users: use the individual modules separately. See docs at ${CONFIG.modulesDocs}`
                )
            );
            process.exit(11);
        }

        try {
            new URL(cmd.url);
        } catch (e) {
            console.log(chalk.red(`[!] Invalid URL: ${cmd.url}`));
            process.exit(12);
        }

        await processUrl(cmd.url, cmd.output, ".", cmd, false);
    } else {
        // since this is a file, we need to first load the URLs in the memory remove empty strings
        const urls = fs
            .readFileSync(cmd.url, "utf-8")
            .split("\n")
            .filter((url) => url !== "");

        // first of all, make a new directory for the tool output
        const toolOutputDir = "js_recon_run_output";
        if (fs.existsSync(toolOutputDir)) {
            console.log(
                chalk.red(
                    `[!] Output directory ${toolOutputDir} already exists. Please switch to other directory or it might conflict with this process.`
                )
            );
            console.log(
                chalk.yellow(
                    `[i] For advanced users: use the individual modules separately. See docs at ${CONFIG.modulesDocs}`
                )
            );
            process.exit(14);
        }
        fs.mkdirSync(toolOutputDir);

        for (const url of urls) {
            // Validate URL only
            let urlObj;
            try {
                urlObj = new URL(url);
            } catch {
                console.log(chalk.bgRed(`[!] Invalid URL: ${url}`));
                continue;
            }

            const thisTargetWorkingDir = `${toolOutputDir}/${urlObj.host.replace(":", "_")}`;
            if (!fs.existsSync(thisTargetWorkingDir)) {
                fs.mkdirSync(thisTargetWorkingDir, { recursive: true });
            }
            const outputDir = `${thisTargetWorkingDir}/output`;
            await processUrl(url, outputDir, thisTargetWorkingDir, cmd, true);
        }
    }
};
