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

                    // get the content of the src file
                    const res = await makeRequest(src, {});
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
