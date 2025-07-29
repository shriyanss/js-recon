import chalk from "chalk";
import fs from "fs";
import yaml from "yaml";
import { ruleSchema } from "./schemas.js";

const validateRules = async (ruleFiles: string[]): Promise<boolean> => {
    console.log(chalk.cyan("[i] Validating rules..."));
    let allValid = true;

    // iterate over the ruleFiles
    for (const ruleFile of ruleFiles) {
        try {
            // open the rule file
            const ruleData = fs.readFileSync(ruleFile, "utf8");

            // parse the rule data
            const rule = yaml.parse(ruleData);

            // check if the rule is valid
            ruleSchema.parse(rule);
        } catch (error: any) {
            allValid = false;
            console.error(chalk.red(`[!] Invalid rule in ${ruleFile}:`));
            if (error.errors) {
                for (const err of error.errors) {
                    console.error(chalk.red(`  - ${err.path.join(".")} - ${err.message}`));
                }
            }
        }
    }

    return allValid;
};

export default validateRules;
