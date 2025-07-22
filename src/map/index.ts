import chalk from "chalk";
import fs from "fs";

// Next.JS
import getWebpackConnections from "./next_js/getWebpackConnections.js";
import getFetchInstances from "./next_js/getFetchInstances.js";
import resolveFetch from "./next_js/resolveFetch.js";
import interactive from "./next_js/interactive.js";
import { existsSync, readFileSync } from "fs";
import { Chunks } from "../utility/interfaces.js";
import getAxiosInstances from "./next_js/getAxiosInstances.js";
import resolveAxios from "./next_js/resolveAxios.js";
import {
    getOpenapi,
    getOpenapiOutput,
    getOpenapiOutputFile,
} from "../utility/globals.js";
import { generateOpenapiV3Spec } from "../utility/openapiGenerator.js";

const availableTech = {
    next: "Next.JS",
};

const availableFormats = {
    json: "JSON",
};

const map = async (
    directory: string,
    output: string,
    formats: Array<keyof typeof availableFormats>,
    tech: string,
    list: boolean,
    interactive_mode: boolean
) => {
    console.log(chalk.cyan("[i] Running 'map' module"));

    if (list) {
        console.log(chalk.cyan("Available technologies:"));
        for (const [key, value] of Object.entries(availableTech)) {
            console.log(chalk.cyan(`- '${key}': ${value}`));
        }
        return;
    }

    // iterate through all the formats, and match it with the available formats
    for (const format of formats) {
        if (!Object.keys(availableFormats).includes(format)) {
            console.log(chalk.red(`[!] Invalid format: ${format}`));
            return;
        }
    }

    if (!tech) {
        console.log(
            chalk.red(
                "[!] Please specify a technology with -t/--tech. Run with -l/--list to see available technologies"
            )
        );
        return;
    }

    if (!directory) {
        console.log(
            chalk.red("[!] Please specify a directory with -d/--directory")
        );
        return;
    }

    if (tech === "next") {
        let chunks: Chunks;

        let allOutputFilesAvailable = true;
        Object.keys(availableFormats).map((key, value) => {
            if (!existsSync(`${output}.${key}`)) {
                allOutputFilesAvailable = false;
            }
        });

        if (!allOutputFilesAvailable) {
            // skip regeneration if output file already exists
            chunks = await getWebpackConnections(directory, output, formats);

            // now, iterate through them, and check fetch instances
            chunks = await getFetchInstances(chunks, output, formats);

            // now, iterate through them, and check axios instances
            chunks = await getAxiosInstances(chunks, output, formats);
        } else {
            // read the JSON file, and load the value
            chunks = JSON.parse(
                readFileSync(`${output}.json`, { encoding: "utf8" })
            );
        }

        // resolve fetch once you've got all
        await resolveFetch(chunks, directory);

        // also, the axios instances
        await resolveAxios(chunks, directory);

        if (interactive_mode) {
            await interactive(chunks, `${output}.json`);
        }

        // check if the openapi output is enabled. if so, then write to file
        if (getOpenapi() === true) {
            // convert the openapi output to JSON
            // it should be openapi v3 specification
            const openapiSpec = generateOpenapiV3Spec(getOpenapiOutput(), chunks);
            const openapiJson = JSON.stringify(openapiSpec, null, 2);
            // write to file
            fs.writeFileSync(getOpenapiOutputFile(), openapiJson);
            console.log(
                chalk.green(
                    `[✓] Generated OpenAPI spec at ${getOpenapiOutputFile()}`
                )
            );
        }
    }
};

export default map;
