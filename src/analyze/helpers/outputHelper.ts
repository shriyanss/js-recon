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

export const generateEngineOutput = (outputFile: string, findings: EngineOutput[]) => {
    console.log(chalk.cyan("[i] Generating engine output..."));
    fs.writeFileSync(outputFile, JSON.stringify(findings, null, 2));
    console.log(chalk.green("[✓] Engine output generated successfully."));
};
