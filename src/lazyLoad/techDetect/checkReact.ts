import makeRequest from "../../utility/makeReq.js";
import * as cheerio from "cheerio";

const REACT_MARKERS = [
    "__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED",
    "__REACT_DEVTOOLS_GLOBAL_HOOK__",
    "react-jsx-runtime.production",
    "react-dom.production",
    "__reactRouterVersion",
] as const;

const matchesReact = (body: string): string | null => {
    for (const marker of REACT_MARKERS) {
        if (body.includes(marker)) return marker;
    }
    return null;
};

const checkReact = async ($: cheerio.CheerioAPI, url: string): Promise<{ detected: boolean; evidence: string }> => {
    let detected = false;
    let evidence = "";

    for (const el of $("script").get()) {
        const attribs = el.attribs;
        if (!attribs) continue;

        const src = attribs["src"];

        if (src) {
            // External script — fetch and scan its content
            let resolvedUrl: string;
            try {
                resolvedUrl = new URL(src, url).href;
            } catch {
                continue;
            }

            const res = await makeRequest(resolvedUrl, {});
            if (!res) continue;
            const body = await res.text();

            const marker = matchesReact(body);
            if (marker) {
                detected = true;
                evidence = `Found "${marker}" in ${src}`;
                break;
            }
        } else {
            // Inline script — scan the text content directly (Vite bundles, etc.)
            const inlineContent = $(el).text();
            if (!inlineContent) continue;

            const marker = matchesReact(inlineContent);
            if (marker) {
                detected = true;
                evidence = `Found "${marker}" in inline <script> on ${url}`;
                break;
            }
        }
    }

    return { detected, evidence };
};

export { checkReact };
