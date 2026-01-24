import makeRequest from "../../utility/makeReq.js";
import * as cheerio from "cheerio";
import chalk from "chalk";
import next_getJSScript from "./next_GetJSScript.js";
import fs from "fs";

const next_scriptTagsSubsequentRequests = async (url: string, endpointsFile: string) => {
    console.log(chalk.cyan("[i] Getting JS files from subsequent requests (script tags)"));

    let endpoints = JSON.parse(fs.readFileSync(endpointsFile, "utf8")).paths;

    endpoints.push("/");

    let jsUrls: string[] = [];

    // TODO: when you get a page, you can also search for anchor tags. If you find any additional
    // pages, you can go through them as well. this will give you a lot more JS files

    // go through all endpoints, and parse them
    for (const endpoint of endpoints) {
        const reqUrl = new URL(endpoint, url).href;
        const jsUrlsFromEndpoint = await next_getJSScript(reqUrl);
        jsUrls.push(...jsUrlsFromEndpoint);
    }

    // dedupe
    jsUrls = [...new Set(jsUrls)];

    if (jsUrls.length !== 0) {
        console.log(chalk.green(`[✓] Found ${jsUrls.length} JS files from subsequent requests (script tags)`));
    }

    return jsUrls;
};

export default next_scriptTagsSubsequentRequests;
