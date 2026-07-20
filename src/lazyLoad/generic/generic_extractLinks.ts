import * as cheerio from "cheerio";

const resolvePageUrl = (rawValue: string | undefined, baseUrl: string): string | null => {
    if (!rawValue) return null;
    const trimmed = rawValue.trim();
    if (!trimmed || trimmed.startsWith("#")) return null;
    if (/^(mailto|tel|javascript|data|blob):/i.test(trimmed)) return null;

    let resolved: URL;
    try {
        resolved = new URL(trimmed, baseUrl);
    } catch {
        return null;
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;

    resolved.hash = "";
    return resolved.href;
};

/**
 * Extracts navigable page URLs from <a href> and <iframe src> tags — not JS files.
 * Used to recursively discover more HTML pages to scan for JS, per internal#66.
 * <iframe src> is included alongside <a href> because embedded widgets (a podcast
 * player, a survey, a booking form) are commonly reachable only via an iframe, never
 * a plain link — the widget's own JS wouldn't otherwise be found without visiting its
 * embedded page directly. Filters out fragment-only links, non-http(s) schemes
 * (mailto/tel/javascript/data/blob), and strips the hash so #section variants of the
 * same page dedupe to one entry.
 */
export const extractPageLinks = (html: string, baseUrl: string): string[] => {
    const $ = cheerio.load(html);
    const links = new Set<string>();

    $("a[href], iframe[src]").each((_, elem) => {
        const rawValue = $(elem).attr("href") ?? $(elem).attr("src");
        const resolved = resolvePageUrl(rawValue, baseUrl);
        if (resolved) links.add(resolved);
    });

    return [...links];
};

export default extractPageLinks;
