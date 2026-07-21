import makeRequest from "../../utility/makeReq.js";
import chalk from "chalk";
import { extractWebpackChunkUrls } from "../shared/webpackChunkParsers.js";

// url param kept for API consistency with other react_* functions
const react_webpackChunkPaths = async (_url: string, maxJsSizeMb: number, jsFiles: string[]): Promise<string[]> => {
    let toReturn: string[] = [];

    for (const jsFile of jsFiles) {
        try {
            const req = await makeRequest(jsFile);

            if (!req || req.status !== 200) continue;

            const contentLength = req.headers.get("content-length");
            if (contentLength && parseInt(contentLength) > maxJsSizeMb * 1024 * 1024) {
                console.error(chalk.yellow(`[!] Skipping ${jsFile} (too large)`));
                continue;
            }

            const jsContent = await req.text();

            if (jsContent.length > maxJsSizeMb * 1024 * 1024) {
                console.error(chalk.yellow(`[!] Skipping ${jsFile} (too large)`));
                continue;
            }

            const urls = extractWebpackChunkUrls(jsContent, jsFile);
            if (urls.length > 0) {
                console.log(chalk.green(`[✓] Found ${urls.length} webpack chunk JS file(s) in ${jsFile}`));
                toReturn.push(...urls);
            }
        } catch (err) {
            console.error(chalk.red(`[!] Error processing ${jsFile}:`, err));
        }
    }

    if (toReturn.length > 0) {
        console.log(chalk.green(`[✓] Found ${toReturn.length} webpack chunk JS files`));
    }

    toReturn = [...new Set(toReturn)];
    return toReturn;
};

export default react_webpackChunkPaths;
