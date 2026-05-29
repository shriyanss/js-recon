import makeRequest from "../../utility/makeReq.js";
import chalk from "chalk";

/**
 * Extracts all JS file references from the content of a JS file:
 *  - Static ESM imports:  import ... from "./chunk.js"  /  import "./chunk.js"
 *  - Dynamic imports:     import("./chunk.js")
 *  - Vite __vite_mapDeps: the flat asset array in the initialiser
 */
const extractImports = (content: string, fileUrl: string, baseUrl: string): string[] => {
    const found: string[] = [];

    // Static imports: from "..." and import "..."
    for (const m of content.matchAll(/\bfrom\s*["']([^"']+\.js)["']/g)) {
        try { found.push(new URL(m[1], fileUrl).href); } catch { /* skip */ }
    }
    for (const m of content.matchAll(/\bimport\s*["']([^"']+\.js)["']/g)) {
        try { found.push(new URL(m[1], fileUrl).href); } catch { /* skip */ }
    }

    // Dynamic imports: import("...")
    for (const m of content.matchAll(/\bimport\s*\(\s*["']([^"']+\.js)["']\s*\)/g)) {
        try { found.push(new URL(m[1], fileUrl).href); } catch { /* skip */ }
    }

    // Vite __vite_mapDeps initialiser: m.f=["assets/chunk1.js","assets/chunk2.js",...]
    const mapDepsMatch = content.match(/m\.f\s*=\s*(\[[^\]]+\])/);
    if (mapDepsMatch) {
        try {
            const arr: string[] = JSON.parse(mapDepsMatch[1]);
            for (const p of arr) {
                try {
                    // Vite asset paths are relative to the origin root
                    const resolved = new URL(p.startsWith("/") ? p : "/" + p, baseUrl).href;
                    found.push(resolved);
                } catch { /* skip */ }
            }
        } catch { /* malformed JSON — ignore */ }
    }

    return found;
};

/**
 * Fetches each JS file in `jsFiles` (skipping already-visited ones), extracts every
 * import reference, and returns the set of newly-discovered URLs.
 *
 * `visited` is mutated in place: callers should pass the same Set across iterations
 * so the recursion terminates once no new files are found.
 */
const react_followImports = async (
    jsFiles: string[],
    maxJsSizeMb: number,
    baseUrl: string,
    visited: Set<string>
): Promise<string[]> => {
    const discovered: string[] = [];

    for (const jsFile of jsFiles) {
        if (visited.has(jsFile)) continue;
        visited.add(jsFile);

        try {
            const req = await makeRequest(jsFile);
            if (!req || req.status !== 200) continue;

            const contentLength = req.headers.get("content-length");
            if (contentLength && parseInt(contentLength) > maxJsSizeMb * 1024 * 1024) {
                console.log(chalk.yellow(`[!] Skipping ${jsFile} (too large)`));
                continue;
            }

            const content = await req.text();
            if (content.length > maxJsSizeMb * 1024 * 1024) {
                console.log(chalk.yellow(`[!] Skipping ${jsFile} (too large)`));
                continue;
            }

            discovered.push(...extractImports(content, jsFile, baseUrl));
        } catch (err) {
            console.log(chalk.yellow(`[!] Could not follow imports in ${jsFile}: ${err}`));
        }
    }

    // Return only URLs not yet in visited (deduplicated)
    return [...new Set(discovered)].filter((u) => !visited.has(u));
};

export default react_followImports;
