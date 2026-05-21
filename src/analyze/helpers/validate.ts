import chalk from "chalk";
import fs from "fs";
import yaml from "yaml";
import { ruleSchema } from "./schemas.js";
import CONFIG from "../../globalConfig.js";

const parseVersion = (version: string): [number, number, number] => {
    const clean = version.split("-")[0];
    const parts = clean.split(".").map(Number);
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
};

const compareVersions = (a: [number, number, number], b: [number, number, number]): number => {
    for (let i = 0; i < 3; i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
};

const isVersionCompatible = (requirement: string, currentVersion: string): boolean => {
    const match = requirement.match(/^(>=|<=|>|<|==?)\s*(.+)/);
    if (!match) return false; // Invalid format
    const [, op, reqVer] = match;
    const current = parseVersion(currentVersion);
    const required = parseVersion(reqVer);
    const cmp = compareVersions(current, required);
    switch (op) {
        case ">=":
            return cmp >= 0;
        case "<=":
            return cmp <= 0;
        case ">":
            return cmp > 0;
        case "<":
            return cmp < 0;
        case "=":
        case "==":
            return cmp === 0;
        default:
            return true;
    }
};

/**
 * Validates a collection of YAML rule files against the defined schema and version requirements.
 *
 * Reads each rule file, parses the YAML content, validates it against the rule schema,
 * and checks whether the rule's declared js_recon_version is satisfied by the current version.
 * Rules that require a higher js-recon version are skipped with a warning.
 *
 * @param ruleFiles - Array of file paths to YAML rule files to validate
 * @returns Promise that resolves to an object with allValid (schema validity) and compatibleRuleFiles (version-compatible files)
 */
const validateRules = async (ruleFiles: string[]): Promise<{ allValid: boolean; compatibleRuleFiles: string[] }> => {
    console.log(chalk.cyan("[i] Validating rules..."));
    let allValid = true;
    const compatibleRuleFiles: string[] = [];

    for (const ruleFile of ruleFiles) {
        try {
            const ruleData = fs.readFileSync(ruleFile, "utf8");
            const rule = yaml.parse(ruleData);
            ruleSchema.parse(rule);

            if (!isVersionCompatible(rule.js_recon_version, CONFIG.version)) {
                console.log(
                    chalk.yellow(
                        `[!] Skipping ${ruleFile}: requires js-recon ${rule.js_recon_version} (current: ${CONFIG.version})`
                    )
                );
                continue;
            }

            compatibleRuleFiles.push(ruleFile);
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

    return { allValid, compatibleRuleFiles };
};

export default validateRules;
