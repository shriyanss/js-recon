import chalk from "chalk";
import fs from "fs";
import { Chunks } from "../utility/interfaces.js";
import prettier from "prettier";

const refactor = async (mappedJson: string, outputDir: string) => {
    console.log(chalk.cyan("[i] Loading refactor module..."));

    // check if the file exists
    if (!fs.existsSync(mappedJson)) {
        console.log(chalk.red("[!] Mapped JSON file does not exist"));
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
        // prettify the code
        const code = await prettier.format(value.code, { parser: "babel" });

        // write the code to a file
        fs.writeFileSync(`${outputDir}/${key}.js`, code);

        console.log(chalk.green(`[i] Chunk ${key} written to ${outputDir}/${key}.js`));
    }

    console.log(chalk.green("[✓] Refactoring complete."));
};

export default refactor;
