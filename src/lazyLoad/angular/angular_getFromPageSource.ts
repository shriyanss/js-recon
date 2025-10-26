import makeRequest from "../../utility/makeReq.js";
import chalk from "chalk";
import * as cheerio from "cheerio";
import resolvePath from "../../utility/resolvePath.js";

const angular_getFromPageSource = async (url: string) => {
    console.log(chalk.cyan("[i] Analyzing page source"));

    let foundUrls: string[] = [];

    const pageSource = await makeRequest(url, {});
    const body = await pageSource.text();

    // cheerio to parse the page source
    const $ = cheerio.load(body);

    // find all the script tags
    const scriptTags = $("script");
    for (const scriptTag of scriptTags) {
        const srcAttr = $(scriptTag).attr("src");
        if (srcAttr) {
            // if it starts with http, then push it directly. if no, then resolve it
            if (srcAttr.startsWith("http")) {
                foundUrls.push(srcAttr);
            } else {
                foundUrls.push(await resolvePath(url, srcAttr));
            }
        }
    }

    return foundUrls;
};

export default angular_getFromPageSource;
