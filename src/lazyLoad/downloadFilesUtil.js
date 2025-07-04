import chalk from "chalk";
import path from "path";
import fs from "fs";
import prettier from "prettier";
import makeRequest from "../utility/makeReq.js";
import { getURLDirectory } from "../utility/urlUtils.js";
import { getScope, getMaxReqQueue } from "./globals.js"; // Import scope and max_req_queue functions

/**
 * Downloads a list of URLs and saves them as files in the specified output directory.
 * It creates the necessary subdirectories based on the URL's host and path.
 * If the URL does not end with `.js`, it is skipped.
 * The function logs the progress and any errors to the console.
 * @param {string[]} urls - An array of URLs to be downloaded.
 * @param {string} output - The directory where the downloaded files will be saved.
 * @returns {Promise<void>}
 */
const downloadFiles = async (urls, output) => {
    console.log(
        chalk.cyan(`[i] Attempting to download ${urls.length} JS chunks`)
    );
    fs.mkdirSync(output, { recursive: true });

    // to store ignored JS domain
    let ignoredJSFiles = [];
    let ignoredJSDomains = [];

    let download_count = 0;
    let queue = 0;

    const downloadPromises = urls.map(async (url) => {
        try {
            await new Promise((resolve) =>
                setTimeout(resolve, Math.random() * 4950 + 50)
            );
            if (url.match(/\.js/)) {
                // get the directory of the url
                const { host, directory } = getURLDirectory(url);

                // check scope of file. Only if in scope, download it
                if (!getScope().includes("*")) {
                    if (!getScope().includes(host)) {
                        ignoredJSFiles.push(url);
                        if (!ignoredJSDomains.includes(host)) {
                            ignoredJSDomains.push(host);
                        }
                        return;
                    }
                }

                // make the directory inside the output folder
                const childDir = path.join(output, host, directory);
                fs.mkdirSync(childDir, { recursive: true });

                let res;
                try {
                    // Wait until there is an available slot in the request queue
                    while (queue >= getMaxReqQueue()) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, Math.random() * 250 + 50)
                        );
                    }
                    queue++; // acquire a slot in the queue

                    res = await makeRequest(url);
                } catch (err) {
                    console.error(chalk.red(`[!] Failed to download: ${url}`));
                } finally {
                    queue--;
                }

                const file = `// JS Source: ${url}\n${await res.text()}`;
                let filename;
                try {
                    filename = url
                        .split("/")
                        .pop()
                        .match(/[a-zA-Z0-9\.\-_]+\.js/)[0];
                } catch (err) {
                    // split the URL into multiple chunks. then iterate
                    // through it, and find whatever matches with JS ext
                    const chunks = url.split("/");
                    for (const chunk of chunks) {
                        if (chunk.match(/\.js$/)) {
                            filename = chunk;
                            break;
                        }
                    }
                }

                if (!filename) {
                    // Handle cases where filename might not be found
                    console.warn(
                        chalk.yellow(
                            `[!] Could not determine filename for URL: ${url}. Skipping.`
                        )
                    );
                    return;
                }

                const filePath = path.join(childDir, filename);
                try {
                    fs.writeFileSync(
                        filePath,
                        await prettier.format(file, { parser: "babel" })
                    );
                } catch (err) {
                    console.error(
                        chalk.red(`[!] Failed to write file: ${filePath}`)
                    );
                }
                download_count++;
            }
        } catch (err) {
            console.error(chalk.red(`[!] Failed to download: ${url}`));
        }
    });

    await Promise.all(downloadPromises);

    if (ignoredJSFiles.length > 0) {
        console.log(
            chalk.yellow(
                `[i] Ignored ${ignoredJSFiles.length} JS files across ${ignoredJSDomains.length} domain(s) - ${ignoredJSDomains.join(", ")}`
            )
        );
    }

    if (download_count > 0) {
        console.log(
            chalk.green(
                `[✓] Downloaded ${download_count} JS chunks to ${output} directory`
            )
        );
    }
};

export default downloadFiles;
