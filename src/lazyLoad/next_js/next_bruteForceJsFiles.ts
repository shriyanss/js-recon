import makeRequest from "../../utility/makeReq.js";
import chalk from "chalk";

const next_bruteForceJsFiles = async (urls: string[]) => {
    // just append .map to all of them and bruteforce for 200
    console.log(chalk.cyan("[i] Bruteforcing .map files"));
    const mapFiles = urls.map((url) => url + ".map");

    let foundSourceMaps: string[] = [];

    for (const mapFile of mapFiles) {
        const req = await makeRequest(mapFile);

        const status = req.status;

        if (status === 200) {
            foundSourceMaps.push(mapFile);
        }
    }

    if (foundSourceMaps.length === 0) {
        console.log(chalk.red("[!] No source maps found"));
        return foundSourceMaps;
    }

    console.log(chalk.green(`[✓] Found ${foundSourceMaps.length} source maps`));
    return foundSourceMaps;
};

export default next_bruteForceJsFiles;
