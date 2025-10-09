import fs from "fs";
import * as next_globals from "./next_globals.js";

export const next_buildId_RSC = async (rsc_directory: string): Promise<string | null> => {
    // list all the files in the directory, including the sub and sub-sub directories
    const files = fs.readdirSync(rsc_directory, { recursive: true });

    // go through those files
    for (const file of files) {
        // check if it is a file. if so, read it
        if (!fs.statSync(rsc_directory + "/" + file).isDirectory()) {
            const fileContent = fs.readFileSync(rsc_directory + "/" + file, "utf8");

            // go through each line
            const lines = fileContent.split("\n");
            for (const line of lines) {
                // check if the line starts with `0:`
                if (line.startsWith("0:")) {
                    // remove the ^0: from the line
                    const buildIdLine = line.replace("0:", "");

                    // parse the remaining content as json
                    const buildIdLineJSON = JSON.parse(buildIdLine);

                    // iterate through the JSON, and get the "b" key and value
                    for (const [key, value] of Object.entries(buildIdLineJSON)) {
                        if (key === "b") {
                            next_globals.setBuildId(value as string);
                            break;
                        }
                    }
                }
            }
        }
    }
    return next_globals.getBuildId();
};
