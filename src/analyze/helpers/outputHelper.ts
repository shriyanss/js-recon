import fs from "fs";
import path from "path";
import chalk from "chalk";

export interface EngineOutput {
    ruleId: string;
    ruleName: string;
    ruleType: string;
    ruleDescription: string;
    ruleAuthor: string;
    ruleTech: ("next" | "all")[];
    severity: string;
    message: string;
    findingLocation: string;
}

/**
 * Writes analysis findings to a JSON file.
 * 
 * @param {string} outputFile - Path to the output file where findings will be written
 * @param {EngineOutput[]} findings - Array of analysis findings to write to the output file
 */
export const generateEngineOutput = (outputFile: string, findings: EngineOutput[]) => {
    console.log(chalk.cyan("[i] Generating engine output..."));
    fs.writeFileSync(outputFile, JSON.stringify(findings, null, 2));
    console.log(chalk.green("[✓] Engine output generated successfully."));
};
