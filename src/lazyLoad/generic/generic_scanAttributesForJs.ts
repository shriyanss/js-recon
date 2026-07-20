import * as cheerio from "cheerio";
import chalk from "chalk";
import makeRequest from "../../utility/makeReq.js";
import { isJsContentType } from "./generic_jsMimeTypes.js";

/**
 * Resolves value against baseUrl and returns the href if it's a network-fetchable
 * (http/https) URL with a path segment ending in ".js" — this is what catches assets
 * served like ".../beacon.min.js/v124/token" (a ".js"-suffixed segment that isn't the
 * last one, so a plain endsWith(".js") check on the whole path would miss it). Returns
 * null for anything unparseable or non-http(s) (data:/blob:/javascript: etc — these
 * aren't requests confirmJsContentType could ever meaningfully make).
 */
export const resolveJsPathCandidate = (value: string, baseUrl: string): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    // A fragment-only ("#selector") or query-only ("?x=1") value resolves against
    // baseUrl by inheriting its pathname completely unchanged. When baseUrl is itself
    // a .js file (e.g. generic_stringsDiscovery.ts resolving strings found INSIDE an
    // already-downloaded JS file), a value that isn't a path reference at all — a CSS
    // selector string embedded in a Vue bundle's scoped styles, say — would otherwise
    // falsely look like a legitimate JS-path candidate purely because it inherited the
    // base's own ".js"-ending pathname.
    if (trimmed.startsWith("#") || trimmed.startsWith("?")) return null;

    let parsed: URL;
    try {
        parsed = new URL(trimmed, baseUrl);
    } catch {
        return null;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    const segments = parsed.pathname.split("/");
    if (!segments.some((seg) => seg.toLowerCase().endsWith(".js"))) return null;
    return parsed.href;
};

/**
 * Pure candidate extraction: walks every element attribute in the given HTML and
 * keeps the ones that resolve to a JS-looking path (see resolveJsPathCandidate).
 */
export const findJsPathSegmentCandidates = (html: string, baseUrl: string): string[] => {
    const $ = cheerio.load(html);
    const candidates = new Set<string>();

    $("*").each((_, elem) => {
        const attribs = (elem as any).attribs as Record<string, string> | undefined;
        if (!attribs) return;
        for (const value of Object.values(attribs)) {
            const resolved = resolveJsPathCandidate(value, baseUrl);
            if (resolved) candidates.add(resolved);
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
export const confirmJsContentType = async (candidates: string[]): Promise<string[]> => {
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
