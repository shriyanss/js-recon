import makeRequest from "../../utility/makeReq.js";
import * as cheerio from "cheerio";

const checkReact = async ($: cheerio.CheerioAPI, url: string): Promise<{ detected: boolean; evidence: string }> => {
    let detected = false;
    let evidence = "";

    // to detect react, first go through all the <script src>

    for (const el of $("script").get()) {
        const attribs = el.attribs;
        if (attribs) {
            for (const [attrName, attrValue] of Object.entries(attribs)) {
                if (attrName === "src") {
                    // get the src
                    const src = attrValue;

                    // Resolve src against the page URL — skip if it's malformed
                    // (e.g. `data:`, `javascript:` schemes, invalid URIs).
                    let resolvedUrl: string;
                    try {
                        resolvedUrl = new URL(src, url).href;
                    } catch {
                        continue;
                    }

                    // makeRequest returns Response | null — skip when the fetch failed.
                    const res = await makeRequest(resolvedUrl, {});
                    if (!res) continue;
                    const body = await res.text();

                    // check if the body contains "react" or "react-dom"
                    if (
                        body.includes("__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED") &&
                        body.includes("__REACT_DEVTOOLS_GLOBAL_HOOK__")
                    ) {
                        detected = true;
                        evidence = `Found "__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED" and "__REACT_DEVTOOLS_GLOBAL_HOOK__" in ${src}`;
                        break;
                    } else if (body.includes("__reactRouterVersion")) {
                        detected = true;
                        evidence = `Found "__reactRouterVersion" in ${src}`;
                        break;
                    }
                }
            }
        }
    }

    return { detected, evidence };
};

export { checkReact };
