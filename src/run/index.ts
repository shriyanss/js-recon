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
import { clearJsUrls, clearJsonUrls } from "../lazyLoad/globals.js";

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
            return;
        }

        let targetHost;
        try {
            targetHost = new URL(cmd.url).host.replace(":", "_");
        } catch (e) {
            console.log(chalk.red(`[!] Invalid URL: ${cmd.url}`));
            process.exit(1);
        }

        console.log(chalk.bgGreenBright("[+] Starting analysis..."));

        console.log(chalk.bgCyan("[1/8] Running lazyload to download JavaScript files..."));
        await lazyLoad(
            cmd.url,
            cmd.output,
            cmd.strictScope,
            cmd.scope.split(","),
            cmd.threads,
            false,
            "",
            cmd.insecure
        );
        console.log(chalk.bgGreen("[+] Lazyload complete."));

        // if tech is undefined, i.e. it can't be detected, quit. Nothing to be done :(
        if (globalsUtil.getTech() === "") {
            console.log(chalk.bgRed("[!] Technology not detected. Quitting."));
            return;
        }

        // since the app only supports next.js now, move ahead only if the tech is next
        if (globalsUtil.getTech() !== "next") {
            console.log(
                chalk.bgYellow(
                    `[!] The tool only supports Next.JS ('next') fully. For ${globalsUtil.getTech()}, only downloading JS files is supported`
                )
            );
            return;
        }

        // run strings
        console.log(chalk.bgCyan("[2/8] Running strings to extract endpoints..."));
        await strings(cmd.output, "strings.json", true, "extracted_urls", false, false, false);
        console.log(chalk.bgGreen("[+] Strings complete."));

        // run lazyload with subsequent requests
        console.log(chalk.bgCyan("[3/8] Running lazyload with subsequent requests to download JavaScript files..."));
        await lazyLoad(
            cmd.url,
            cmd.output,
            cmd.strictScope,
            cmd.scope.split(","),
            cmd.threads,
            true,
            "extracted_urls.json",
            cmd.insecure
        );
        console.log(chalk.bgGreen("[+] Lazyload with subsequent requests complete."));

        // run strings again to extract endpoints from the files that are downloaded in the previous step
        console.log(chalk.bgCyan("[4/8] Running strings again to extract endpoints..."));
        await strings(cmd.output, "strings.json", true, "extracted_urls", cmd.secrets, true, true);
        console.log(chalk.bgGreen("[+] Strings complete."));

        // now, run map
        console.log(chalk.bgCyan("[5/8] Running map to find functions..."));
        globalsUtil.setOpenapi(true);
        await map(cmd.output + "/" + targetHost, "mapped", ["json"], globalsUtil.getTech(), false, false);
        console.log(chalk.bgGreen("[+] Map complete."));

        // now, run endpoints
        console.log(chalk.bgCyan("[6/8] Running endpoints to extract endpoints..."));
        // check if the subsequent requests directory exists
        if (fs.existsSync(`${cmd.output}/${targetHost}/___subsequent_requests`)) {
            await endpoints(
                cmd.url,
                `${cmd.output}/${targetHost}/`,
                "endpoints",
                ["json"],
                "next",
                false,
                "mapped.json"
            );
        } else {
            await endpoints(cmd.url, undefined, "endpoints", ["json"], "next", false, "mapped.json");
        }
        console.log(chalk.bgGreen("[+] Endpoints complete."));

        // run the analyze module now
        console.log(chalk.bgCyan("[7/8] Running analyze to extract endpoints..."));
        // since the thirs argument is tech, and it can't be "all", so adding type ignore
        // @ts-ignore
        await analyze("", "mapped.json", globalsUtil.getTech(), false, "mapped-openapi.json", false, "analyze.json");
        console.log(chalk.bgGreen("[+] Analyze complete."));

        // run the report module now
        console.log(chalk.bgCyan("[8/8] Running report module..."));
        await report("js-recon.db", "mapped.json", "analyze.json", "endpoints.json", "mapped-openapi.json", "report");
        console.log(chalk.bgGreen("[+] Report complete."));

        console.log(chalk.bgGreenBright("[+] Analysis complete."));
    } else {
        // since this is a file, we need to first load the URLs in the memory remove empty strings
        const urls = fs
            .readFileSync(cmd.url, "utf-8")
            .split("\n")
            .filter((url) => url !== "");

        // iterate through the URLs, and make sure they are valid URLs
        let allPassed = true;
        for (const url of urls) {
            try {
                let urlTest = new URL(url);
            } catch (e) {
                console.log(chalk.red(`[!] Invalid URL: ${url}`));
                allPassed = false;
            }
        }
        if (!allPassed) {
            return;
        }

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
            return;
        }
        fs.mkdirSync(toolOutputDir);

        // now, run the steps one by one
        for (const url of urls) {
            // check if output directory exists. If so, ask the user to switch to other directory
            // if not done, it might conflict this process
            // for devs: run `npm run cleanup` to prepare this directory
            const thisTargetWorkingDir = toolOutputDir + "/" + new URL(url).host.replace(":", "_");
            // make the directory
            fs.mkdirSync(thisTargetWorkingDir);
            const outputDir = thisTargetWorkingDir + "/output";

            const targetHost = new URL(url).host.replace(":", "_");

            console.log(chalk.bgGreenBright("[+] Starting analysis..."));

            // first of all, clear the jsUrls/jsonUrls cache
            clearJsUrls();
            clearJsonUrls();

            console.log(chalk.bgCyan("[1/8] Running lazyload to download JavaScript files..."));
            await lazyLoad(url, outputDir, cmd.strictScope, cmd.scope.split(","), cmd.threads, false, "", cmd.insecure);
            console.log(chalk.bgGreen("[+] Lazyload complete."));

            // if tech is "", i.e. it can't be detected, quit. Nothing to be done :(
            if (globalsUtil.getTech() === "") {
                console.log(chalk.bgRed("[!] Technology not detected. Quitting."));
                continue;
            }

            // since the app only supports next.js now, move ahead only if the tech is next
            if (globalsUtil.getTech() !== "next") {
                console.log(
                    chalk.bgYellow(
                        `[!] The tool only supports Next.JS ('next') fully. For ${globalsUtil.getTech()}, only downloading JS files is supported`
                    )
                );
                continue;
            }

            // run strings
            console.log(chalk.bgCyan("[2/8] Running strings to extract endpoints..."));
            await strings(
                outputDir,
                `${thisTargetWorkingDir}/strings.json`,
                true,
                `${thisTargetWorkingDir}/extracted_urls`,
                false,
                false,
                false
            );
            console.log(chalk.bgGreen("[+] Strings complete."));

            // run lazyload with subsequent requests
            console.log(
                chalk.bgCyan("[3/8] Running lazyload with subsequent requests to download JavaScript files...")
            );
            await lazyLoad(
                url,
                outputDir,
                cmd.strictScope,
                cmd.scope.split(","),
                cmd.threads,
                true,
                `${thisTargetWorkingDir}/extracted_urls.json`,
                cmd.insecure
            );
            console.log(chalk.bgGreen("[+] Lazyload with subsequent requests complete."));

            // run strings again to extract endpoints from the files that are downloaded in the previous step
            console.log(chalk.bgCyan("[4/8] Running strings again to extract endpoints..."));
            await strings(
                outputDir,
                `${thisTargetWorkingDir}/strings.json`,
                true,
                `${thisTargetWorkingDir}/extracted_urls`,
                cmd.secrets,
                true,
                true
            );
            console.log(chalk.bgGreen("[+] Strings complete."));

            // now, run map
            console.log(chalk.bgCyan("[5/8] Running map to find functions..."));
            globalsUtil.setOpenapi(true);
            globalsUtil.setOpenapiOutputFile(`${thisTargetWorkingDir}/mapped-openapi.json`);
            await map(
                outputDir + "/" + targetHost,
                `${thisTargetWorkingDir}/mapped`,
                ["json"],
                globalsUtil.getTech(),
                false,
                false
            );
            console.log(chalk.bgGreen("[+] Map complete."));

            // now, run endpoints
            console.log(chalk.bgCyan("[6/8] Running endpoints to extract endpoints..."));
            // check if the subsequent requests directory exists
            if (fs.existsSync(`${outputDir}/${targetHost}/___subsequent_requests`)) {
                await endpoints(
                    url,
                    `${outputDir}/${targetHost}/`,
                    `${thisTargetWorkingDir}/endpoints`,
                    ["json"],
                    "next",
                    false,
                    `${thisTargetWorkingDir}/mapped.json`
                );
            } else {
                await endpoints(
                    url,
                    undefined,
                    `${thisTargetWorkingDir}/endpoints`,
                    ["json"],
                    "next",
                    false,
                    `${thisTargetWorkingDir}/mapped.json`
                );
            }
            console.log(chalk.bgGreen("[+] Endpoints complete."));

            // run the analyze module now
            console.log(chalk.bgCyan("[7/8] Running analyze to extract endpoints..."));
            // since the thirs argument is tech, and it can't be "all", so adding type ignore
            // @ts-ignore
            await analyze(
                "",
                `${thisTargetWorkingDir}/mapped.json`,
                // ignoring the below line coz "next" is a string, and the tool won't work if this is incorrect
                // @ts-ignore
                globalsUtil.getTech(),
                false,
                `${thisTargetWorkingDir}/mapped-openapi.json`,
                false,
                `${thisTargetWorkingDir}/analyze.json`
            );
            console.log(chalk.bgGreen("[+] Analyze complete."));

            // run the report module now
            console.log(chalk.bgCyan("[8/8] Running report module..."));
            await report(
                `${thisTargetWorkingDir}/js-recon.db`,
                `${thisTargetWorkingDir}/mapped.json`,
                `${thisTargetWorkingDir}/analyze.json`,
                `${thisTargetWorkingDir}/endpoints.json`,
                `${thisTargetWorkingDir}/mapped-openapi.json`,
                `${thisTargetWorkingDir}/report`
            );
            console.log(chalk.bgGreen("[+] Report complete."));

            console.log(chalk.bgGreenBright("[+] Analysis complete."));
        }
    }
};
