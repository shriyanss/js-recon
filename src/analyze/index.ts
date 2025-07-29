import chalk from "chalk";
import yaml from "yaml";
import fs from "fs";
import path from "path";
import { Rule } from "./types/index.js";

const availableTechs = {
    next: "Next.js",
};

const analyze = async (
    rulesPath: string,
    mappedJson: string,
    tech: string,
    list: boolean,
    openapi: string,
    validate: boolean
) => {
    console.log(chalk.green(`[i] Loading analyze module...`));

    // check if `rules` exists
    if (!fs.existsSync(rulesPath)) {
        console.log(chalk.red(`[!] Rules ${rulesPath} does not exist`));
        return;
    }

    // now that the rule thing exist, check if it is a direcotory or a file
    let ruleFiles: string[] = [];
    if (fs.lstatSync(rulesPath).isDirectory()) {
        ruleFiles = fs.readdirSync(rulesPath).filter((file) => file.endsWith(".yaml"));
    } else {
        ruleFiles = [rulesPath];
    }

    // check if the validate flag is passed. If so, validate the rules and return
    if (validate) {
        console.log(chalk.green("[i] Validating rules..."));
        return;
    }

    // check if the list flag is passed. If so, list the techs and return
    if (list) {
        console.log(chalk.green("[i] List of available technologies"));
        for (const [key, value] of Object.entries(availableTechs)) {
            console.log(chalk.green(`- ${key}: ${value}`));
        }
        return;
    }

    // check if a valid tech is passed
    if (!availableTechs[tech]) {
        console.log(chalk.red(`[!] Invalid technology ${tech}.`));
        console.log(chalk.yellow("[i] Run with -l/--list to see available technologies"));
        return;
    }

    // check if either mappedJson or either openapi is passed
    if (!mappedJson && !openapi) {
        console.log(chalk.red("[!] Either mappedJson or openapi must be passed"));
        return;
    }

    // check if the mappedJson and openapi exists if they are not undefined
    if (mappedJson && !fs.existsSync(mappedJson)) {
        console.log(chalk.red(`[!] Mapped JSON ${mappedJson} does not exist`));
        return;
    }
    if (openapi && !fs.existsSync(openapi)) {
        console.log(chalk.red(`[!] OpenAPI spec ${openapi} does not exist`));
        return;
    }

    // load the mapped json and openapi in memory
    let mappedJsonData: any;
    let openapiData: any;
    if (mappedJson) {
        mappedJsonData = JSON.parse(fs.readFileSync(mappedJson, "utf8"));
        console.log(chalk.green(`[i] Mapped JSON loaded successfully`));
    }
    if (openapi) {
        openapiData = JSON.parse(fs.readFileSync(openapi, "utf8"));
        console.log(chalk.green(`[i] OpenAPI spec loaded successfully`));
    }
};

export default analyze;
