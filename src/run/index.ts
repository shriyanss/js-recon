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

const getCdnDir = async (host: string, outputDir: string): Promise<string | undefined> => {
    // get the JS URLs
    let cdnDir: string | undefined;
    for (const url of getJsUrls()) {
        if (url.includes("_next/static/chunks")) {
            // check if the host and url.host match
            const urlHost = new URL(url).host.replace(":", "_");
            if (urlHost !== host) {
                cdnDir = path.join(outputDir, urlHost);
                break;
            }
        }
    }
    return cdnDir;
};

const processUrl = async (url, outputDir, workingDir, cmd, isBatch) => {
    const targetHost = new URL(url).host.replace(":", "_");

    console.log(chalk.bgGreenBright(`[+] Starting analysis for ${url}...`));

    if (isBatch) {
        clearJsUrls();
        clearJsonUrls();
    }

    console.log(chalk.bgCyan("[1/8] Running lazyload to download JavaScript files..."));
    await lazyLoad(url, outputDir, cmd.strictScope, cmd.scope.split(","), cmd.threads, false, "", cmd.insecure);
    console.log(chalk.bgGreen("[+] Lazyload complete."));

    if (globalsUtil.getTech() === "") {
        console.log(chalk.bgRed("[!] Technology not detected. Quitting."));
        process.exit(10);
    }

    if (globalsUtil.getTech() !== "next") {
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
        cmd.insecure
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

export default async (cmd) => {
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

        let urlTest = new URL(cmd.url);
        if (!urlTest) {
            console.log(chalk.red("[!] Invalid URL"));
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
    }
};
