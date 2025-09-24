import fs from "fs";
import chalk from "chalk";
import iterate_n_store from "./utility/iterate_n_store.js";

/**
 * Generates a JSON report from a list of URLs.
 *
 * @param {string} url - The base URL to resolve relative URLs against
 * @param {string[]} hrefs - The list of URLs to iterate over
 * @param {string} output - The output file path
 * @returns {Promise<string>} - A promise that resolves to the generated JSON report
 */
const gen_json = async (url: string, hrefs: string[], output: string) => {
    // iterate over hrefs
    const result = await iterate_n_store(url, hrefs);

    const finalJSON = JSON.stringify(result, null, 2);
    fs.writeFileSync(`${output}.json`, finalJSON);

    console.log(chalk.green(`[✓] Generated JSON report at ${output}.json`));
    return finalJSON;
};

export default gen_json;
