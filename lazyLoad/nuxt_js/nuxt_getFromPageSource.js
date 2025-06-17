import makeRequest from "../../utility/makeReq.js";
import { getJsUrls, pushToJsUrls } from "../globals.js";
import * as cheerio from "cheerio";

const nuxt_getFromPageSource = async (url) => {
    // get the page source
    const res = await makeRequest(url);
    const pageSource = await res.text();

    // cheerio to parse the page source
    const $ = cheerio.load(pageSource);

    // find all link tags
    const linkTags = $("link");

    // go through them, and find the ones which have `as=script` attr
    for (const linkTag of linkTags) {
        const asAttr = $(linkTag).attr("as");
        if (asAttr === "script") {
            const hrefAttr = $(linkTag).attr("href");
            if (hrefAttr) {
                // see if it starts with /_nuxt
                if (hrefAttr.startsWith("/_nuxt")) {
                    // get the URL root, and append the hrefAttr to it
                    const urlRoot = new URL(url).origin;
                    pushToJsUrls(urlRoot + hrefAttr);
                }
            }
        }
    }

    return getJsUrls();
};

export default nuxt_getFromPageSource;