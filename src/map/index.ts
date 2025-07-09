import chalk from "chalk";

// Next.JS
import getWebpackConnections from "./next_js/getWebpackConnections.js";
import getFetchInstances from "./next_js/getFetchInstances.js";
import resolveFetch from "./next_js/resolveFetch.js";
import interactive from "./next_js/interactive.js";
import { existsSync, readFileSync } from "fs";
import { Chunks } from "../utility/interfaces.js";

const availableTech = {
    next: "Next.JS",
};

const availableFormats = {
    json: "JSON",
};

const map = async (
    directory: string,
    output: string,
    formats: string[],
    tech: string,
    list: boolean,
    interactive_mode: boolean,
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
                "[!] Please specify a technology with -t/--tech. Run with -l/--list to see available technologies",
            ),
        );
        return;
    }

    if (!directory) {
        console.log(
            chalk.red("[!] Please specify a directory with -d/--directory"),
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
        } else {
            // read the JSON file, and load the value
            chunks = JSON.parse(readFileSync(`${output}.json`, { encoding: "utf8" }));
        }

        // resolve fetch once you've got all
        await resolveFetch(chunks, directory, formats);

        if (interactive_mode) {
            await interactive(chunks, `${output}.json`);
        }
    }
};

export default map;
