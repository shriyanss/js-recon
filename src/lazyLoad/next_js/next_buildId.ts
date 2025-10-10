import fs from "fs";
import path from "path";
import * as next_globals from "./next_globals.js";

export const next_buildId_RSC = async (rsc_directory: string): Promise<string | null> => {
    const traverseDirectory = (directory: string): boolean => {
        const dirents = fs.readdirSync(directory, { withFileTypes: true });

        for (const dirent of dirents) {
            const fullPath = path.join(directory, dirent.name);

            if (dirent.isDirectory()) {
                if (traverseDirectory(fullPath)) {
                    return true;
                }
                continue;
            }

            if (!dirent.isFile()) {
                continue;
            }

            const fileContent = fs.readFileSync(fullPath, "utf8");

            const lines = fileContent.split("\n");
            for (const line of lines) {
                if (line.startsWith("0:")) {
                    const buildIdLine = line.replace("0:", "");
                    const buildIdLineJSON = JSON.parse(buildIdLine);

                    for (const [key, value] of Object.entries(buildIdLineJSON)) {
                        if (key === "b") {
                            next_globals.setBuildId(value as string);
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    };

    traverseDirectory(rsc_directory);
    return next_globals.getBuildId();
};

