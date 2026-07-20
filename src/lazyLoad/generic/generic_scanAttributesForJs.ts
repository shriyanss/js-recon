import * as cheerio from "cheerio";
import chalk from "chalk";
import makeRequest from "../../utility/makeReq.js";
import { isJsContentType } from "./generic_jsMimeTypes.js";

/**
 * Pure candidate extraction: walks every element attribute in the given HTML,
 * resolves each value against baseUrl with the URL constructor, and keeps only
 * URLs where some path segment ends with ".js" — this is what catches assets
 * served like ".../beacon.min.js/v124/token" (a ".js"-suffixed segment that
 * isn't the final one, so a plain endsWith(".js") check would miss it).
 */
export const findJsPathSegmentCandidates = (html: string, baseUrl: string): string[] => {
    const $ = cheerio.load(html);
    const candidates = new Set<string>();

    $("*").each((_, elem) => {
        const attribs = (elem as any).attribs as Record<string, string> | undefined;
        if (!attribs) return;
        for (const value of Object.values(attribs)) {
            if (!value) continue;
            let parsed: URL;
            try {
                parsed = new URL(value, baseUrl);
            } catch {
                continue;
            }
            const segments = parsed.pathname.split("/");
            if (segments.some((seg) => seg.toLowerCase().endsWith(".js"))) {
                candidates.add(parsed.href);
            }
        }
    });

    return [...candidates];
};

/**
 * Confirms each candidate is actually JavaScript via Content-Type (per RFC 9239 /
 * RFC 4329 and legacy variants — see generic_jsMimeTypes.ts), not just the URL shape.
 * Uses GET rather than HEAD: makeRequest's response cache is keyed on URL only (not
 * method), so a cached HEAD response would poison the later GET that downloads the
 * body — every other crawler in this codebase uses GET for the same reason.
 */
const confirmJsContentType = async (candidates: string[]): Promise<string[]> => {
    const confirmed: string[] = [];

    for (const url of candidates) {
        let contentType: string | null = null;
        try {
            const res = await makeRequest(url, { method: "GET" });
            contentType = res?.headers.get("content-type") ?? null;
        } catch {
            continue;
        }

        if (isJsContentType(contentType)) {
            console.log(chalk.green(`[✓] Confirmed JS via Content-Type: ${url}`));
            confirmed.push(url);
        }
    }

    return confirmed;
};

const generic_scanAttributesForJs = async (html: string, baseUrl: string): Promise<string[]> => {
    const candidates = findJsPathSegmentCandidates(html, baseUrl);
    if (candidates.length === 0) return [];
    return confirmJsContentType(candidates);
};

export default generic_scanAttributesForJs;
