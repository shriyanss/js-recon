import { Chunks } from "../../../utility/interfaces.js";
import chalk from "chalk";

/**
 * Finds the chunks that export and import Axios clients.
 * @param {Chunks} chunks - Collection of code chunks to analyze
 * @returns {{axiosExportedTo: string[], axiosImportedTo: { [key: string]: string }}
 *      - an object containing two properties: axiosExportedTo and axiosImportedTo.
 *      - axiosExportedTo is an array of chunk names that have an Axios client.
 *      - axiosImportedTo is an object where each key is a chunk name and the value is the name of the Axios client chunk that it imports.
 */
export const findAxiosClients = (
    chunks: Chunks
): { axiosExportedTo: string[]; axiosImportedTo: { [key: string]: string } } => {
    let axiosExportedTo: string[] = [];
    let axiosImportedTo: { [key: string]: string } = {};

    // first get those which have axios client
    for (const chunkName of Object.keys(chunks)) {
        if (chunks[chunkName].isAxiosClient) {
            axiosExportedTo.push(chunkName);
        }
    }

    // now, see which ones import those
    for (const chunkName of Object.keys(chunks)) {
        // iterate through the names of the axios clients
        for (const axiosExportFunctionId of axiosExportedTo) {
            // iterate through the imports of the all the chunks, and see which ones have axios clients imported
            for (const importName of chunks[chunkName].imports) {
                if (importName === axiosExportFunctionId) {
                    axiosImportedTo[chunkName] = axiosExportFunctionId;

                    console.log(chalk.green(`[✓] ${chunkName} imports axios client ${axiosExportFunctionId}`));
                }
            }
        }
    }

    return { axiosExportedTo, axiosImportedTo };
};
