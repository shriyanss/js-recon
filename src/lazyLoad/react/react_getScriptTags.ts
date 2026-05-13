import makeRequest from "../../utility/makeReq.js";
import * as cheerio from "cheerio";

const react_getScriptTags = async (url: string, maxJsSizeMb: number): Promise<string[]> => {
    let toReturn: string[] = [];

    // get the page source
    const req = await makeRequest(url);
    const pageSource = await req.text();

    // iterate through the page source and get the script tags
    const $ = cheerio.load(pageSource);
    $("script").each((i, elem) => {
        const src = $(elem).attr("src");
        if (src) {
            toReturn.push(new URL(src, url).href);
        }
    });

    toReturn = [...new Set(toReturn)]; // dedupe the files
    return toReturn;
};

export default react_getScriptTags;
