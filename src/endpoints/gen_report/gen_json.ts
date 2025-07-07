import fs from "fs";
import chalk from "chalk";
import iterate_n_store from "./utility/iterate_n_store.js";

const gen_json = async (url: string, hrefs: string[], output: string) => {
    // iterate over hrefs
    const result = await iterate_n_store(url, hrefs);

    const finalJSON = JSON.stringify(result, null, 2);
    fs.writeFileSync(`${output}.json`, finalJSON);

    console.log(chalk.green(`[✓] Generated JSON report at ${output}.json`));
    return finalJSON;
};

export default gen_json;
