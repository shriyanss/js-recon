import chalk from "chalk";
import fs from "fs";
import path from "path";
import { Chunks } from "../utility/interfaces.js";
import prettier from "prettier";

// Next.js
import refactorNext from "./next/index.js";
// React
import refactorReact from "./react/index.js";

// Maps a refactor tech to the scat-combo directory name in a baseline tree.
// Must match LIB_SIG_SCAT in src/refactor/<tech>/index.ts (sorted alphabetically, joined with "-").
const BASELINE_SCAT_DIR: Record<string, string> = {
    "react-webpack": "lit-decl-loop-cond",
};

// Resolves `--collisions <path>` to a concrete collisions.json. Accepts:
//   - a file path → returned as-is
//   - a directory → searched in order:
//       <dir>/baselines/<tech>/<scat>/collisions.json
//       <dir>/<tech>/<scat>/collisions.json
//       <dir>/<scat>/collisions.json
//       <dir>/collisions.json
const resolveCollisionsPath = (input: string, tech: string): string | null => {
    if (!fs.existsSync(input)) return null;
    const stat = fs.statSync(input);
    if (stat.isFile()) return input;
    const scat = BASELINE_SCAT_DIR[tech];
    const candidates = [
        scat ? path.join(input, "baselines", tech, scat, "collisions.json") : null,
        scat ? path.join(input, tech, scat, "collisions.json") : null,
        scat ? path.join(input, scat, "collisions.json") : null,
        path.join(input, "collisions.json"),
    ].filter(Boolean) as string[];
    for (const c of candidates) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
    return null;
};

const availableTechs = {
    next: "Next.js",
    "react-webpack": "React (webpack)",
};

/**
 * Refactors JavaScript code chunks based on technology-specific patterns.
 *
 * This function takes mapped code chunks and applies technology-specific refactoring
 * rules to improve code readability, remove obfuscation, and standardize formatting.
 * The refactored code is written to individual files in the output directory.
 *
 * @param mappedJson - Path to the mapped JSON file containing code chunks
 * @param outputDir - Directory where refactored code files will be written
 * @param tech - Technology stack identifier (e.g., 'next' for Next.js)
 * @param list - Whether to list available technologies instead of running refactoring
 * @returns Promise that resolves when refactoring is complete
 */
const refactor = async (
    mappedJson: string,
    outputDir: string,
    tech: string,
    list: boolean,
    collisionsFile?: string
): Promise<void> => {
    console.log(chalk.cyan("[i] Loading refactor module..."));

    // check if the file exists
    if (!fs.existsSync(mappedJson)) {
        console.log(chalk.red("[!] Mapped JSON file does not exist"));
        process.exit(7);
    }

    if (list) {
        console.log(chalk.cyan("[i] Listing available technologies"));
        for (const tech of Object.keys(availableTechs)) {
            console.log(chalk.green(`- ${tech}: ${availableTechs[tech]}`));
        }
        return;
    }

    // verify if the tech provided is valid
    if (!Object.keys(availableTechs).includes(tech)) {
        console.log(chalk.red("[!] Invalid technology provided"));
        process.exit(8);
    }

    // check if the output directory already exists
    if (fs.existsSync(outputDir)) {
        console.log(chalk.red("[!] Output directory already exists"));
        process.exit(9);
    } else {
        fs.mkdirSync(outputDir);
    }

    // read the mapped JSON file
    const chunks: Chunks = JSON.parse(fs.readFileSync(mappedJson, "utf8"));

    // optional: load CS-MAST cross-app baseline signatures from a collisions.json (or a directory)
    let libSigs: Set<string> | undefined;
    if (collisionsFile) {
        const resolved = resolveCollisionsPath(collisionsFile, tech);
        if (!resolved) {
            console.log(chalk.red(`[!] Could not find a collisions.json under: ${collisionsFile}`));
            const scat = BASELINE_SCAT_DIR[tech];
            if (scat) {
                console.log(
                    chalk.red(
                        `    expected one of:\n` +
                            `      <dir>/baselines/${tech}/${scat}/collisions.json\n` +
                            `      <dir>/${tech}/${scat}/collisions.json\n` +
                            `      <dir>/${scat}/collisions.json\n` +
                            `      <dir>/collisions.json`
                    )
                );
            }
            process.exit(10);
        }
        const records = JSON.parse(fs.readFileSync(resolved, "utf8")) as Array<{
            signature: string;
            count: number;
        }>;
        // Treat any signature shared across the whole baseline corpus as library code.
        const maxCount = records.reduce((m, r) => (r.count > m ? r.count : m), 0);
        libSigs = new Set(records.filter((r) => r.count >= maxCount).map((r) => r.signature));
        console.log(
            chalk.cyan(`[i] Loaded ${libSigs.size} library signatures (count>=${maxCount}) from ${resolved}`)
        );
    }

    // iterate through the chunks
    for (const [key, value] of Object.entries(chunks)) {
        if (tech === "next") {
            const moduleFiles = await refactorNext(value);
            for (const [moduleId, rawCode] of Object.entries(moduleFiles)) {
                const formatted = await prettier.format(rawCode, {
                    parser: "babel",
                    singleQuote: true,
                    trailingComma: "none",
                });
                fs.writeFileSync(`${outputDir}/${moduleId}.js`, formatted);
                console.log(chalk.green(`[✓] Module ${moduleId} written to ${outputDir}/${moduleId}.js`));
            }
        } else if (tech === "react-webpack") {
            const moduleFiles = await refactorReact(value, libSigs);
            for (const [moduleId, rawCode] of Object.entries(moduleFiles)) {
                const formatted = await prettier.format(rawCode, {
                    parser: "babel",
                    singleQuote: true,
                    trailingComma: "none",
                });
                fs.writeFileSync(`${outputDir}/${moduleId}.js`, formatted);
                console.log(chalk.green(`[✓] Module ${moduleId} written to ${outputDir}/${moduleId}.js`));
            }
        }
    }

    console.log(chalk.green("[✓] Refactoring complete."));
};

export default refactor;
