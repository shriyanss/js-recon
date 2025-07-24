import chalk from "chalk";
import fs from "fs";

// Next.JS
import client_subsequentRequests from "./next_js/client_subsequentRequests.js";
import client_jsFilesHref from "./next_js/client_jsFilesHref.js";
import client_jsonParse from "./next_js/client_jsonParse.js";
import getWebpacks from "./next_js/getWebpacks.js";

// Report Generation
import gen_markdown from "./gen_report/gen_markdown.js";
import gen_json from "./gen_report/gen_json.js";

const techs = ["Next.JS (next)"];
const outputFormats = ["md", "json"];

const endpoints = async (url, directory, output, outputFormat, tech, list, subsequentRequestsDir) => {
    console.log(chalk.cyan("[i] Loading endpoints module"));

    // list available technologies
    if (list) {
        console.log(chalk.cyan("[i] Listing available technologies"));
        for (const tech of techs) {
            console.log(chalk.greenBright(`- ${tech}`));
        }
        return;
    }

    // iterate over the output format, and match it with the available output formats
    for (const format of outputFormat) {
        if (!outputFormats.includes(format)) {
            console.log(chalk.red("[!] Invalid output format"));
            return;
        }
    }

    // check if the directory is present
    if (!directory) {
        console.log(chalk.red("[!] Please provide a directory"));
        return;
    }

    // check if the technology is present
    if (!tech) {
        console.log(chalk.red("[!] Please provide a technology"));
        return;
    }

    // check if the output file is present
    if (!output) {
        console.log(chalk.red("[!] Please provide an output file"));
        return;
    }

    // check if the url is present
    if (!url) {
        console.log(chalk.red("[!] Please provide a URL"));
        return;
    }

    console.log(chalk.cyan("[i] Extracting endpoints"));

    if (tech === "next") {
        console.log(chalk.cyan("[i] Checking for client-side paths for Next.JS"));

        // check if the subsequent requests directory is present
        if (!subsequentRequestsDir) {
            console.log(
                chalk.red("[!] Please provide a directory containing subsequent requests (--subsequent-requests-dir)")
            );
            return;
        }

        // check if the subsequent requests directory exists
        if (!fs.existsSync(subsequentRequestsDir)) {
            console.log(chalk.red("[!] Directory containing subsequent requests does not exist"));
            return;
        }

        let final_client_side: string[] = [];
        const client_subsequentRequestsResult = await client_subsequentRequests(subsequentRequestsDir, url);
        final_client_side.push(...client_subsequentRequestsResult);

        // first, get all the webpacks
        // const webpacksFound = await getWebpacks(directory);

        const client_jsFilesHrefResult = await client_jsFilesHref(directory);
        final_client_side.push(...client_jsFilesHrefResult);

        const client_jsonParseResult = await client_jsonParse(directory);
        final_client_side.push(...client_jsonParseResult);

        if (outputFormat.includes("md")) {
            const gen_markdownResult = await gen_markdown(url, final_client_side, output);
        }
        if (outputFormat.includes("json")) {
            const gen_jsonResult = await gen_json(url, final_client_side, output);
        }
    }
};

export default endpoints;
