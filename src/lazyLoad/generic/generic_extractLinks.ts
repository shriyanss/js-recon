import * as cheerio from "cheerio";

/**
 * Extracts navigable page URLs from <a href> tags — not JS files. Used to
 * recursively discover more HTML pages to scan for JS, per internal#66.
 * Filters out fragment-only links, non-http(s) schemes (mailto/tel/javascript/
 * data/blob), and strips the hash so #section variants of the same page
 * dedupe to one entry.
 */
export const extractPageLinks = (html: string, baseUrl: string): string[] => {
    const $ = cheerio.load(html);
    const links = new Set<string>();

    $("a[href]").each((_, elem) => {
        const href = $(elem).attr("href");
        if (!href) return;
        const trimmed = href.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        if (/^(mailto|tel|javascript|data|blob):/i.test(trimmed)) return;

        let resolved: URL;
        try {
            resolved = new URL(trimmed, baseUrl);
        } catch {
            return;
        }
        if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return;

        resolved.hash = "";
        links.add(resolved.href);
    });

    return [...links];
};

export default extractPageLinks;
