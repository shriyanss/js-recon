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

type LibSigsResult = { sigs: Set<string>; desc: string };

// Parses a collisions.json file and returns signatures whose count equals the maximum.
const loadCollisionsFile = (filePath: string): Set<string> => {
    const records = JSON.parse(fs.readFileSync(filePath, "utf8")) as Array<{
        signature: string;
        count: number;
    }>;
    const maxCount = records.reduce((m, r) => (r.count > m ? r.count : m), 0);
    return new Set(records.filter((r) => r.count >= maxCount).map((r) => r.signature));
};

// Resolves `--collisions <path>` to a library signature set. Accepts:
//   - a file path → reads directly (max-count signatures)
//   - a standard directory → tries known candidate paths in order:
//       <dir>/baselines/<tech>/<scat>/collisions.json
//       <dir>/<tech>/<scat>/collisions.json
//       <dir>/<scat>/collisions.json
//       <dir>/collisions.json
//   - a per-feature results directory → detects <dir>/<feature>/<scat>/collisions.json
//       and intersects max-count signatures across all feature subdirs (reads only
//       the relevant scat files, not the full dataset tree)
const buildLibSigs = (input: string, tech: string): LibSigsResult | null => {
    if (!fs.existsSync(input)) return null;
    const stat = fs.statSync(input);
    const scat = BASELINE_SCAT_DIR[tech];

    // Case 1: direct file path
    if (stat.isFile()) {
        return { sigs: loadCollisionsFile(input), desc: input };
    }

    // Case 2: standard directory candidates (existing layout)
    const candidates = [
        scat ? path.join(input, "baselines", tech, scat, "collisions.json") : null,
        scat ? path.join(input, tech, scat, "collisions.json") : null,
        scat ? path.join(input, scat, "collisions.json") : null,
        path.join(input, "collisions.json"),
    ].filter(Boolean) as string[];
    for (const c of candidates) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) {
            return { sigs: loadCollisionsFile(c), desc: c };
        }
    }

    // Case 3: per-feature results directory — <dir>/<feature>/<scat>/collisions.json
    // Only the scat-relevant files are read (one per feature subdir), so memory usage
    // stays low even when the full dataset tree is hundreds of gigabytes.
    if (scat) {
        const featureFiles: string[] = [];
        for (const entry of fs.readdirSync(input, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const p = path.join(input, entry.name, scat, "collisions.json");
            if (fs.existsSync(p)) featureFiles.push(p);
        }
        if (featureFiles.length > 0) {
            // Intersect max-count signatures across all feature subdirs.
            // A signature present in every feature's max-count set must come from
            // code shared by all apps — i.e. library code.
            let intersection: Set<string> | null = null;
            for (const p of featureFiles) {
                const sigs = loadCollisionsFile(p);
                if (intersection === null) {
                    intersection = sigs;
                } else {
                    for (const sig of intersection) {
                        if (!sigs.has(sig)) intersection.delete(sig);
                    }
                }
            }
            if (intersection && intersection.size > 0) {
                return {
                    sigs: intersection,
                    desc: `${input} (intersection of ${featureFiles.length} feature dirs)`,
                };
            }
        }
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

    if (list) {
        console.log(chalk.cyan("[i] Listing available technologies"));
        for (const key of Object.keys(availableTechs) as Array<keyof typeof availableTechs>) {
            console.log(chalk.green(`- ${key}: ${availableTechs[key]}`));
        }
        return;
    }

    // check if the file exists
    if (!fs.existsSync(mappedJson)) {
        console.error(chalk.red("[!] Mapped JSON file does not exist"));
        process.exit(7);
    }

    // verify if the tech provided is valid
    if (!Object.keys(availableTechs).includes(tech)) {
        console.error(chalk.red("[!] Invalid technology provided"));
        process.exit(8);
    }

    // check if the output directory already exists
    if (fs.existsSync(outputDir)) {
        console.error(chalk.red("[!] Output directory already exists"));
        process.exit(9);
    } else {
        fs.mkdirSync(outputDir);
    }

    // read the mapped JSON file
    const chunks: Chunks = JSON.parse(fs.readFileSync(mappedJson, "utf8"));

    // optional: load CS-MAST cross-app baseline signatures from a collisions.json (or a directory)
    let libSigs: Set<string> | undefined;
    if (collisionsFile) {
        const result = buildLibSigs(collisionsFile, tech);
        if (!result) {
            console.log(chalk.red(`[!] Could not resolve library signatures from: ${collisionsFile}`));
            const scat = BASELINE_SCAT_DIR[tech];
            if (scat) {
                console.log(
                    chalk.red(
                        `    accepted layouts:\n` +
                            `      <file>                                           (direct collisions.json)\n` +
                            `      <dir>/baselines/${tech}/${scat}/collisions.json\n` +
                            `      <dir>/${tech}/${scat}/collisions.json\n` +
                            `      <dir>/${scat}/collisions.json\n` +
                            `      <dir>/collisions.json\n` +
                            `      <dir>/<feature>/${scat}/collisions.json          (per-feature results dir)`
                    )
                );
            }
            process.exit(10);
        }
        libSigs = result.sigs;
        console.log(chalk.cyan(`[i] Loaded ${libSigs.size} library signatures from ${result.desc}`));
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
