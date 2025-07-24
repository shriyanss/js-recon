import endpoints from "../endpoints/index.js";
import strings from "../strings/index.js";
import map from "../map/index.js";
import * as globalsUtil from "../utility/globals.js";
import * as fs from "fs";
import lazyLoad from "../lazyLoad/index.js";
import chalk from "chalk";
import CONFIG from "../globalConfig.js";

export default async (cmd) => {
    globalsUtil.setApiGatewayConfigFile(cmd.apiGatewayConfig);
    globalsUtil.setUseApiGateway(cmd.apiGateway);
    globalsUtil.setDisableCache(cmd.disableCache);
    globalsUtil.setRespCacheFile(cmd.cacheFile);
    globalsUtil.setYes(cmd.yes);

    // check if the given URL is a file
    if (fs.existsSync(cmd.url)) {
        console.log(chalk.red(`[!] Please provide a single URL. Parsing a list of URLs isn't available`));
        console.log(
            chalk.yellow(
                `To run the tool against, a list of targets, pass the file in '-u' flag of 'lazyload' module, and it will download the JS files`
            )
        );
        return;
    }

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

    const targetHost = new URL(cmd.url).host;

    console.log(chalk.bgGreenBright("[+] Starting analysis..."));

    console.log(chalk.bgCyan("[1/6] Running lazyload to download JavaScript files..."));
    await lazyLoad(cmd.url, cmd.output, cmd.strictScope, cmd.scope.split(","), cmd.threads, false, "");
    console.log(chalk.bgGreen("[+] Lazyload complete."));

    // globals.setTech("next");

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
    console.log(chalk.bgCyan("[2/6] Running strings to extract endpoints..."));
    await strings(cmd.output, "strings.json", true, "extracted_urls", false, false, false);
    console.log(chalk.bgGreen("[+] Strings complete."));

    // run lazyload with subsequent requests
    console.log(chalk.bgCyan("[3/6] Running lazyload with subsequent requests to download JavaScript files..."));
    await lazyLoad(
        cmd.url,
        cmd.output,
        cmd.strictScope,
        cmd.scope.split(","),
        cmd.threads,
        true,
        "extracted_urls.json"
    );
    console.log(chalk.bgGreen("[+] Lazyload with subsequent requests complete."));

    // run strings again to extract endpoints from the files that are downloaded in the previous step
    console.log(chalk.bgCyan("[4/6] Running strings again to extract endpoints..."));
    await strings(cmd.output, "strings.json", true, "extracted_urls", cmd.secrets, true, true);
    console.log(chalk.bgGreen("[+] Strings complete."));

    // now, run endpoints
    console.log(chalk.bgCyan("[5/6] Running endpoints to extract endpoints..."));
    // check if the subsequent requests directory exists
    if (fs.existsSync(`output/${targetHost}/___subsequent_requests`)) {
        await endpoints(
            cmd.url,
            cmd.output,
            "strings",
            ["json"],
            globalsUtil.getTech(),
            false,
            `output/${targetHost}/___subsequent_requests`
        );
        console.log(chalk.bgGreen("[+] Endpoints complete."));
    } else {
        console.log(chalk.bgYellow("[!] Subsequent requests directory does not exist. Skipping endpoints."));
    }

    // now, run map
    console.log(chalk.bgCyan("[6/6] Running map to find functions..."));
    await map(cmd.output + "/" + targetHost, "mapped", ["json"], globalsUtil.getTech(), false, false);
    console.log(chalk.bgGreen("[+] Map complete."));

    console.log(chalk.bgGreenBright("[+] Analysis complete."));
};
