import chalk from "chalk";
import fs from "fs";

const permutate = async (urls: string[], paths: string[], output: string): Promise<void> => {
    console.log(chalk.cyan("[i] Permutating URLs and paths"));

    let permutedUrls = [];

    //   go through each URL
    for (const url of urls) {
        // check if the URL is valid or not by passing to URL
        try {
            new URL(url);
        } catch (err) {
            continue;
        }

        // now that's a valid URL, get the base URL from it
        const baseUrl = new URL(url).origin;

        // go through each path
        for (const path of paths) {
            // join the baseurl and the path, and push it to an array
            permutedUrls.push(new URL(path, baseUrl).href);
        }
    }

    // append all the urls also
    permutedUrls.push(...urls);

    // get the origin aka baseurl, and push those also
    for (const url of urls) {
        try {
            permutedUrls.push(new URL(url).origin);
        } catch {}
    }

    // deduplicate
    permutedUrls = [...new Set(permutedUrls)];

    // write to a .txt file
    const results = permutedUrls.join("\n");
    try {
        fs.writeFileSync(`${output}.txt`, results);
        console.log(chalk.green(`[✓] Written permuted URLs to ${output}.txt`));
    } catch (error) {
        console.error(chalk.red(`[✗] Failed to write to ${output}.txt: ${error.message}`));
        throw error;
    }
};

export default permutate;
