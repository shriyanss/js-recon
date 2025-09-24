import chalk from "chalk";
import fs from "fs";
import { Chunks } from "../utility/interfaces.js";
import prettier from "prettier";

// Next.js
import refactorNext from "./next/index.js";

const availableTechs = {
    next: "Next.js",
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
const refactor = async (mappedJson: string, outputDir: string, tech: string, list: boolean): Promise<void> => {
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

    // iterate through the chunks
    for (const [key, value] of Object.entries(chunks)) {
        let code: string;

        if (tech === "next") {
            code = await refactorNext(value);
        }

        // prettify the code before writing
        code = await prettier.format(code, {
            parser: "babel",
            singleQuote: true,
            trailingComma: "none",
        });

        // write the code to a file
        fs.writeFileSync(`${outputDir}/${key}.js`, code);

        console.log(chalk.green(`[i] Chunk ${key} written to ${outputDir}/${key}.js`));
    }

    console.log(chalk.green("[✓] Refactoring complete."));
};

export default refactor;
