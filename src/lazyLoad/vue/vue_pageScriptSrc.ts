import makeRequest from "../../utility/makeReq.js";
import chalk from "chalk";
import * as cheerio from "cheerio";

const vue_pageScriptSrc = async (url: string) => {
    let toReturn: string[] = [];

    // first, get the contents of the homepage
    const req = await makeRequest(url);
    if (req == null) {
        console.log(chalk.red(`Failed to fetch ${url}`));
        return toReturn;
    }
    const homepageContent = await req.text();

    // get all the script srcs
    const $ = cheerio.load(homepageContent);
    $("script").each((_, el) => {
        const src = $(el).attr("src");
        if (src) {
            console.log(src);
        }
    });

    return toReturn;
}

export default vue_pageScriptSrc;
