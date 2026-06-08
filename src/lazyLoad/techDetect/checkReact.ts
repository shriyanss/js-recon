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

const fetchAndCheck = async (src: string, url: string): Promise<string | null> => {
    let resolvedUrl: string;
    try {
        resolvedUrl = new URL(src, url).href;
    } catch {
        return null;
    }

    // Fast path: filename itself contains "react"
    const filename = resolvedUrl.split("/").pop() ?? "";
    if (/react/i.test(filename)) {
        return `React-named file referenced: ${src}`;
    }

    const res = await makeRequest(resolvedUrl, {});
    if (!res) return null;
    const body = await res.text();
    const marker = matchesReact(body);
    return marker ? `Found "${marker}" in ${src}` : null;
};

const checkReact = async ($: cheerio.CheerioAPI, url: string): Promise<{ detected: boolean; evidence: string }> => {
    // Check <script src="..."> elements
    for (const el of $("script").get()) {
        const attribs = el.attribs;
        if (!attribs) continue;

        const src = attribs["src"];
        if (src) {
            const evidence = await fetchAndCheck(src, url);
            if (evidence) return { detected: true, evidence };
        } else {
            // Inline script — scan the text content directly (Vite bundles, etc.)
            const inlineContent = $(el).text();
            if (!inlineContent) continue;

            const marker = matchesReact(inlineContent);
            if (marker) {
                return { detected: true, evidence: `Found "${marker}" in inline <script> on ${url}` };
            }
        }
    }

    // Check <link rel="modulepreload"> elements (Vite splits React into separate vendor chunks)
    for (const el of $("link").get()) {
        const attribs = el.attribs;
        if (!attribs) continue;
        if (attribs["rel"] !== "modulepreload") continue;

        const href = attribs["href"];
        if (!href) continue;

        const evidence = await fetchAndCheck(href, url);
        if (evidence) return { detected: true, evidence };
    }

    return { detected: false, evidence: "" };
};

export { checkReact };
