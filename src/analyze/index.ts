import chalk from "chalk";
import fs from "fs";
import path from "path";
import validateRules from "./helpers/validate.js";
import { Rule } from "./types/index.js";
import engine from "./engine/index.js";
import yaml from "yaml";
import { Chunks } from "../utility/interfaces.js";
import { OpenAPISpec } from "../utility/openapiGenerator.js";
import initRules from "./helpers/initRules.js";
import { EngineOutput, generateEngineOutput } from "./helpers/outputHelper.js";

const availableTechs = {
    next: "Next.js",
};

const getRuleFilesRecursive = (dir: string): string[] => {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getRuleFilesRecursive(file));
        } else {
            if (file.endsWith(".yml") || file.endsWith(".yaml")) {
                results.push(file);
            }
        }
    });
    return results;
};

const analyze = async (
    rulesPath: string,
    mappedJson: string,
    tech: "next",
    list: boolean,
    openapi: string,
    validate: boolean,
    outputFile: string
) => {
    console.log(chalk.cyan(`[i] Loading analyze module...`));

    await initRules();

    // check if `-r` flag is there. If not, default to `~/.js-recon/rules`
    if (!rulesPath) {
        rulesPath = path.join(process.env.HOME, "/.js-recon/rules");
    }

    // check if `rules` exists
    if (!fs.existsSync(rulesPath)) {
        console.log(chalk.red(`[!] Rules ${rulesPath} does not exist`));
        return;
    }

    // now that the rule thing exist, check if it is a direcotory or a file
    let ruleFiles: string[] = [];

    if (fs.lstatSync(rulesPath).isDirectory()) {
        ruleFiles = getRuleFilesRecursive(rulesPath);
    } else {
        ruleFiles = [rulesPath];
    }

    // now, validate all those files
    const allValidated = await validateRules(ruleFiles);

    if (!allValidated) {
        console.log(chalk.red("[!] Some rules are invalid"));
        process.exit(1);
    }

    if (validate) {
        console.log(chalk.green("[✓] All rules are valid"));
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
    let mappedJsonData: Chunks | undefined;
    let openapiData: OpenAPISpec | undefined;
    if (mappedJson) {
        mappedJsonData = JSON.parse(fs.readFileSync(mappedJson, "utf8"));
        console.log(chalk.green(`[✓] Mapped JSON loaded successfully`));
    }
    if (openapi) {
        openapiData = JSON.parse(fs.readFileSync(openapi, "utf8"));
        console.log(chalk.green(`[✓] OpenAPI spec loaded successfully`));
    }

    // iterate over the ruleFiles
    let ruleFindings: EngineOutput[] = [];
    for (const ruleFile of ruleFiles) {
        // load the rule
        const rule: Rule = yaml.parse(fs.readFileSync(ruleFile, "utf8"));

        // run the rule
        const engineFindings: EngineOutput[] = await engine(rule, mappedJsonData, openapiData, tech);

        // add findings to the global findings
        if (engineFindings) {
            ruleFindings.push(...engineFindings);
        }
    }

    // generate the engine output
    generateEngineOutput(outputFile, ruleFindings);
};

export default analyze;
