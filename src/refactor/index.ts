import chalk from "chalk";
import fs from "fs";
import { Chunks } from "../utility/interfaces.js";
import prettier from "prettier";

// Next.js
import refactorNext from "./next/index.js";

const availableTechs = {
    next: "Next.js",
};

const refactor = async (mappedJson: string, outputDir: string, tech: string, list: boolean) => {
    console.log(chalk.cyan("[i] Loading refactor module..."));

    // check if the file exists
    if (!fs.existsSync(mappedJson)) {
        console.log(chalk.red("[!] Mapped JSON file does not exist"));
        process.exit(1);
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
        process.exit(1);
    }

    // check if the output directory already exists
    if (fs.existsSync(outputDir)) {
        console.log(chalk.red("[!] Output directory already exists"));
        process.exit(1);
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
