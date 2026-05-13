import * as cheerio from "cheerio";
import makeRequest from "../../utility/makeReq.js";

const checkAngularJS = async ($: cheerio.CheerioAPI, url: string) => {
    let detected = false;
    let evidence = "";

    // to detect angular js, first check if it has something like `main-*.js` or `main.js` in script src
    let hasMainJs = false;
    let mainJsURL: string | undefined = undefined;
    $("script").each((_, el) => {
        const tag = $(el).get(0).tagName;
        const attribs = el.attribs;
        if (attribs) {
            for (const [attrName, attrValue] of Object.entries(attribs)) {
                if (attrName === "src") {
                    // @ts-ignore
                    if (attrValue.includes("main-")) {
                        hasMainJs = true;

                        // if the url starts with `main-...`, then build the full url
                        if (!attrValue.startsWith("http")) {
                            mainJsURL = new URL(attrValue, url).href;
                        } else {
                            mainJsURL = attrValue;
                        }
                    }
                }
            }
        }
    });

    // now, get the contents of the main.js file
    if (hasMainJs) {
        const mainJsRes = await makeRequest(mainJsURL, {});
        const mainJsBody = await mainJsRes.text();

        // check if the traces of angular js are present
        // using regex for this, as this is simple and fast

        // check: isAngularZone(), "isAngularZone", this.ngZone
        // if lazyload enabled, need to check routerlink: `["routerLink",`
        const isAngularZoneRegex = /isAngularZone\(\)/;
        const isAngularZoneRegex2 = /"isAngularZone"/;
        const ngZoneRegex = /this\.ngZone/;
        const routerLinkRegex = /"routerLink"/;

        if (isAngularZoneRegex.test(mainJsBody)) {
            detected = true;
            evidence = "isAngularZone()";
        } else if (isAngularZoneRegex2.test(mainJsBody)) {
            detected = true;
            evidence = '"isAngularZone"';
        } else if (ngZoneRegex.test(mainJsBody)) {
            detected = true;
            evidence = "this.ngZone";
        } else if (routerLinkRegex.test(mainJsBody)) {
            detected = true;
            evidence = "routerLink";
        }
    }

    return { detected, evidence };
};

export { checkAngularJS };
