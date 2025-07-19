import { Chunks } from "../../utility/interfaces.js";
import chalk from "chalk";
import fs from "fs";

const getAxiosInstances = async (
    chunks: Chunks,
    output: string,
    formats: string[]
) => {
    console.log(chalk.cyan("[i] Getting axios instances"));

    let chunkCopy = structuredClone(chunks);
    // iterate through all the chunks
    for (const chunk of Object.values(chunks)) {
        const chunkCode = chunk.code;

        // regex checks first
        const axiosVarRegex_AxiosHeaders = /AxiosHeaders = /;
        const axiosVarRegex_isAxiosError = /isAxiosError = /;
        const axiosVarRegex_AxiosError = /AxiosError = /;
        const axiosObjectRegex_AxiosHeaders = /\.AxiosHeaders/;
        const axiosObjectRegex_isAxiosError = /\.isAxiosError/;
        const axiosObjectRegex_AxiosError = /\.AxiosError/;

        // go through the code, and see if all of these matches or not
        let axiosDetected = false;
        if (
            axiosVarRegex_AxiosHeaders.test(chunkCode) &&
            axiosVarRegex_isAxiosError.test(chunkCode) &&
            axiosVarRegex_AxiosError.test(chunkCode) &&
            axiosObjectRegex_AxiosHeaders.test(chunkCode) &&
            axiosObjectRegex_isAxiosError.test(chunkCode) &&
            axiosObjectRegex_AxiosError.test(chunkCode)
        ) {
            axiosDetected = true;
        }

        if (axiosDetected) {
            chunkCopy[chunk.id].isAxiosClient = true;
            console.log(chalk.green(`[✓] Axios detected in chunk ${chunk.id}`));
        }
    }

    // write the chunk to the output file
    if (formats.includes("json")) {
        const chunks_json = JSON.stringify(chunkCopy, null, 2);
        fs.writeFileSync(`${output}.json`, chunks_json);
        console.log(
            chalk.green(
                `[✓] Saved webpack with axios instances to ${output}.json`
            )
        );
    }

    return chunkCopy;
};

export default getAxiosInstances;
