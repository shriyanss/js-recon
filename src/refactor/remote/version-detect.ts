// Version detection for React bundles using CS-MAST-S reliable signatures.
// Fetches per-version reliable_signatures.json from the HuggingFace dataset and
// matches them against CS-MAST signatures generated from the target bundle's chunks.

import fs from "fs";
import path from "path";
import os from "os";
import chalk from "chalk";
import { cs_mast_init, ScatCategory } from "@shriyanss/cs-mast";
import { HF_BUCKET, getHfRawUrl, getHfApiTreeUrl, fetchText } from "./hf-client.js";
import { Chunks } from "../../utility/interfaces.js";

// Maps refactor tech identifier to the bundler name used in the HF version bucket path.
export const VERSION_TECH_TO_BUNDLER: Record<string, string> = {
    "react-webpack": "webpack",
    "react-vite": "vite",
};

// Maps HF version folder name to npm semver strings for package.json generation.
// react-dom is absent for React versions that predated the react-dom split (< 0.14).
const REACT_VERSION_TO_NPM: Record<string, { react: string; reactDom?: string }> = {
    "react-0.11": { react: "0.11.2" },
    "react-0.12": { react: "0.12.2" },
    "react-0.13": { react: "0.13.3" },
    "react-0.14": { react: "0.14.10", reactDom: "0.14.10" },
    "react-15": { react: "15.7.0", reactDom: "15.7.0" },
    "react-16": { react: "16.14.0", reactDom: "16.14.0" },
    "react-17": { react: "17.0.2", reactDom: "17.0.2" },
    "react-18": { react: "18.3.1", reactDom: "18.3.1" },
    "react-19": { react: "19.1.0", reactDom: "19.1.0" },
};

export type VersionDetectionResult = {
    versionKey: string; // e.g. "react-18"
    reactNpm: string; // e.g. "18.3.1"
    reactDomNpm?: string; // e.g. "18.3.1"
    matchCount: number; // number of reliable signatures matched in the bundle
};

const VERSION_CACHE_DIR = path.join(os.homedir(), ".js-recon", "refactor", "version_sigs_cache");

// Cache TTL: 7 days (matches the list-cache TTL for collisions.json files).
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getVersionCachePath(bundler: string, version: string, scatDir: string): string {
    return path.join(VERSION_CACHE_DIR, bundler, version, scatDir, "reliable_signatures.json");
}

function loadCachedReliableSigs(bundler: string, version: string, scatDir: string): string[] | null {
    const filePath = getVersionCachePath(bundler, version, scatDir);
    const cachedAtPath = filePath + ".cached_at";
    if (!fs.existsSync(filePath) || !fs.existsSync(cachedAtPath)) return null;
    try {
        const cachedAt = parseInt(fs.readFileSync(cachedAtPath, "utf8").trim(), 10);
        if (isNaN(cachedAt) || Date.now() - cachedAt > CACHE_TTL_MS) return null;
        return JSON.parse(fs.readFileSync(filePath, "utf8")) as string[];
    } catch {
        return null;
    }
}

function saveCachedReliableSigs(bundler: string, version: string, scatDir: string, sigs: string[]): void {
    const filePath = getVersionCachePath(bundler, version, scatDir);
    const cachedAtPath = filePath + ".cached_at";
    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(sigs));
        fs.writeFileSync(cachedAtPath, String(Date.now()));
    } catch {
        // Non-fatal — next run will re-fetch
    }
}

// Lists available React version directories under version/react/<bundler>/ in the HF bucket.
// Returns an array of version folder names like ["react-16", "react-17", "react-18"].
async function listAvailableVersions(bundler: string): Promise<string[]> {
    const prefix = `version/react/${bundler}`;
    const dirs = new Set<string>();
    let nextUrl: string | null = getHfApiTreeUrl(prefix);

    while (nextUrl) {
        let resp: Response;
        try {
            resp = await fetch(nextUrl);
        } catch {
            break;
        }
        if (resp.status === 429) throw new Error(`Rate limited by HuggingFace`);
        if (!resp.ok) break;

        const text = await resp.text();
        try {
            const entries = JSON.parse(text) as Array<{ path: string }>;
            const prefixSlash = prefix.endsWith("/") ? prefix : `${prefix}/`;
            for (const e of entries) {
                const rel = e.path.startsWith(prefixSlash) ? e.path.slice(prefixSlash.length) : e.path;
                const parts = rel.split("/");
                if (parts.length > 1 && parts[0].startsWith("react-")) dirs.add(parts[0]);
            }
        } catch {
            break;
        }

        const linkHeader = resp.headers.get("link");
        const match = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
        nextUrl = match ? match[1] : null;
    }

    return Array.from(dirs).sort();
}

// Fetches (or loads from cache) reliable_signatures.json for one (bundler, version, scatDir) combo.
// Returns an array of PHC signature strings, or null if not available.
async function fetchReliableSignatures(
    bundler: string,
    version: string,
    scatDir: string
): Promise<string[] | null> {
    const cached = loadCachedReliableSigs(bundler, version, scatDir);
    if (cached !== null) return cached;

    const hfSubpath = `${version}/${scatDir}/reliable_signatures.json`;
    const url = getHfRawUrl(`version/react/${bundler}`, hfSubpath);
    const text = await fetchText(url);
    if (text === null) return null;

    try {
        const sigs = JSON.parse(text) as string[];
        if (!Array.isArray(sigs)) return null;
        saveCachedReliableSigs(bundler, version, scatDir, sigs);
        return sigs;
    } catch {
        return null;
    }
}

// Generates the set of all CS-MAST sub-tree signatures from every chunk in the mapped JSON,
// plus any extra code snippets (e.g. vendor chunk file contents not included in mapped.json).
// Uses the same scat categories that drove library stripping so detection uses a consistent
// signature space.
function generateBundleSignatures(chunks: Chunks, scat: ScatCategory[], extraCodes?: string[]): Set<string> {
    const allSigs = new Set<string>();
    const codesToHash: string[] = [
        ...Object.values(chunks)
            .map((c) => c.code)
            .filter(Boolean),
        ...(extraCodes ?? []),
    ];
    for (const code of codesToHash) {
        try {
            const tree = cs_mast_init(code, {
                hash: "sha256",
                scat,
                sinc: [],
                lang: "js",
                prsr: "@babel/parser",
                sourceType: "unambiguous",
            });
            for (const sig of tree._signatureMap.keys()) {
                allSigs.add(sig);
            }
        } catch {
            // Unparseable chunk (e.g. CSS-in-JS string, syntax error) — skip silently
        }
    }
    return allSigs;
}

/**
 * Detects the React version used in a bundle by matching its CS-MAST signatures against
 * per-version reliable_signatures.json files from the HuggingFace dataset.
 *
 * @param chunks      - Parsed mapped.json chunks from the target bundle
 * @param tech        - Refactor tech identifier (e.g. "react-webpack")
 * @param scatDir     - Scat directory name used for this run (e.g. "lit-decl-loop-cond")
 * @param extraCodes  - Additional raw JS code strings to include in signature generation
 *                      (e.g. vendor chunk files that contain React library code but are
 *                      not present in mapped.json)
 * @returns The best-matching version result, or null if no version data available or no match found
 */
export async function detectReactVersion(
    chunks: Chunks,
    tech: string,
    scatDir: string,
    extraCodes?: string[]
): Promise<VersionDetectionResult | null> {
    const bundler = VERSION_TECH_TO_BUNDLER[tech];
    if (!bundler) return null;

    // List available versions for this bundler
    console.log(chalk.cyan(`[i] Version detection: listing available React versions for ${bundler}...`));
    let versions: string[];
    try {
        versions = await listAvailableVersions(bundler);
    } catch (e) {
        console.log(chalk.yellow(`[!] Version detection: could not list versions (${String(e)})`));
        return null;
    }

    if (versions.length === 0) {
        console.log(chalk.yellow(`[!] Version detection: no version data found for ${bundler} in the dataset`));
        return null;
    }

    // Derive ScatCategory[] from scatDir for signature generation.
    // scatDir uses hyphens as separators and op_name uses an underscore internally —
    // splitting on "-" yields valid ScatCategory values for all 511 combos.
    const scat = scatDir.split("-") as ScatCategory[];

    const totalCodeUnits = Object.keys(chunks).length + (extraCodes?.length ?? 0);
    console.log(
        chalk.cyan(
            `[i] Version detection: generating signatures from ${totalCodeUnits} code unit(s) (scat: ${scatDir})...`
        )
    );
    const bundleSigs = generateBundleSignatures(chunks, scat, extraCodes);

    if (bundleSigs.size === 0) {
        console.log(chalk.yellow(`[!] Version detection: could not generate any signatures from chunks`));
        return null;
    }

    console.log(
        chalk.cyan(`[i] Version detection: checking ${versions.length} versions for signature matches...`)
    );

    let bestMatch: VersionDetectionResult | null = null;

    for (const version of versions) {
        const reliableSigs = await fetchReliableSignatures(bundler, version, scatDir);
        if (!reliableSigs || reliableSigs.length === 0) continue;

        let matchCount = 0;
        for (const sig of reliableSigs) {
            if (bundleSigs.has(sig)) matchCount++;
        }

        if (matchCount > 0) {
            const npmInfo = REACT_VERSION_TO_NPM[version];
            if (!npmInfo) continue;

            if (!bestMatch || matchCount > bestMatch.matchCount) {
                bestMatch = {
                    versionKey: version,
                    reactNpm: npmInfo.react,
                    reactDomNpm: npmInfo.reactDom,
                    matchCount,
                };
            }
        }
    }

    return bestMatch;
}
