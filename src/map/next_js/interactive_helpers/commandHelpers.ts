import chalk from "chalk";
import { Chunk, Chunks } from "../../../utility/interfaces.js";

const commandHelpers = {
    fetchMenu: (chunks: Chunks) => {
        let returnText = chalk.cyan(
            "List of chunks that contain fetch instances\n"
        );
        for (const chunk of Object.values(chunks)) {
            if (chunk.containsFetch) {
                returnText += chalk.green(
                    `- ${chunk.id}: ${chunk.file} (${chunk.description})\n`
                );
            }
        }
        return returnText;
    },
    getFunctionCode: (chunks: Chunks, funcName: string) => {
        let funcCode;
        for (const chunk of Object.values(chunks)) {
            if (chunk.id == funcName) {
                funcCode = chunk.code;
            }
        }
        if (!funcCode) {
            return chalk.red(`Function ${funcName} not found`);
        }
        return funcCode;
    },
    listAllFunctions: (chunks: Chunks) => {
        let returnText = chalk.cyan("List of all functions\n");
        for (const chunk of Object.values(chunks)) {
            returnText += chalk.green(
                `- ${chunk.id}: ${chunk.description} (${chunk.file})\n`
            );
        }
        return returnText;
    },
    navHistory: (chunks: Chunks, navList) => {
        let returnText = chalk.cyan("Navigation history\n");
        if (navList.length === 0) {
            returnText += chalk.yellow("- No navigation history");
        } else {
            for (const id of navList) {
                returnText += chalk.green(
                    `- ${id}: ${chunks[id].description}\n`
                );
            }
        }
        return returnText;
    },
    traceFunction: (chunks: Chunks, funcName) => {
        let returnText = chalk.cyan(`Tracing function ${funcName}\n`);
        const thisChunk = chunks[funcName];
        if (!thisChunk) {
            returnText += chalk.red(`Function ${funcName} not found`);
        } else {
            // get imports
            if (thisChunk.imports.length === 0) {
                returnText += chalk.yellow("- No imports");
            } else {
                returnText += chalk.greenBright("Imports:\n");
                for (const importName of thisChunk.imports) {
                    const funcDesc = chunks[importName].description;
                    returnText += chalk.green(`- ${importName}: ${funcDesc}\n`);
                }
            }

            returnText += "\n";
            // get functions which import this particular function
            // iterate over the function
            let exported_to_chunks = [];
            for (const chunk of Object.values(chunks)) {
                // get the imports
                const chunk_imports = chunk.imports;

                // see if the import includes this particular ID
                for (const chunk_import of chunk_imports) {
                    // if so, then push to the var
                    if (chunk_import == funcName) {
                        exported_to_chunks.push(chunk.id);
                    }
                }
            }

            // append to return text
            if (exported_to_chunks.length === 0) {
                returnText += chalk.yellow("- No exports");
            } else {
                returnText += chalk.greenBright("Exports:\n");
                for (const exportName of exported_to_chunks) {
                    returnText += chalk.green(
                        `- ${exportName}: ${chunks[exportName].description}\n`
                    );
                }
            }
        }
        return returnText;
    },
};

export default commandHelpers;
