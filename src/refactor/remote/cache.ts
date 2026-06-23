import fs from "fs";
import path from "path";
import { getRefactorConfigDir } from "./config.js";
import { CollisionRecord } from "./hf-client.js";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// --- List cache ---

export type ListCache = {
    generatedAt: number; // unix ms timestamp
    branches: Record<string, string[]>; // branch → array of relative collisions.json paths
};

const getListCachePath = (): string => path.join(getRefactorConfigDir(), "cs-mast-s-list-cache.json");

export const loadListCache = (): ListCache | null => {
    const p = getListCachePath();
    if (!fs.existsSync(p)) return null;
    try {
        const raw = JSON.parse(fs.readFileSync(p, "utf8")) as unknown;
        if (typeof raw !== "object" || raw === null) return null;
        const c = raw as Record<string, unknown>;
        if (typeof c.generatedAt !== "number") return null;
        if (typeof c.branches !== "object" || c.branches === null) return null;
        return raw as ListCache;
    } catch {
        return null;
    }
};

export const saveListCache = (data: ListCache): void => {
    const dir = getRefactorConfigDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getListCachePath(), JSON.stringify(data, null, 2));
};

export const isListCacheStale = (cache: ListCache): boolean =>
    Date.now() - cache.generatedAt > ONE_WEEK_MS;

export const shouldRefreshListCache = (
    cache: ListCache | null,
    opts: { refreshCache: boolean; skipCacheChecks: boolean }
): boolean => {
    if (opts.refreshCache) return true;
    if (cache === null) return true;
    if (!opts.skipCacheChecks && isListCacheStale(cache)) return true;
    return false;
};

// --- Signature file cache ---

const getSignatureCacheRoot = (): string =>
    path.join(getRefactorConfigDir(), "signature_cache");

// subpath is the relative file path from the HF branch root,
// e.g. "01-usestate-hook-webpack/lit-decl-loop-cond/collisions.json"
const getSignatureCacheDir = (branch: string, subpath: string): string => {
    // Strip the trailing "/collisions.json" to get the directory path.
    const dir = subpath.endsWith("/collisions.json")
        ? subpath.slice(0, -"/collisions.json".length)
        : subpath;
    return path.join(getSignatureCacheRoot(), branch, dir);
};

export const getSignatureCacheFilePath = (branch: string, subpath: string): string =>
    path.join(getSignatureCacheDir(branch, subpath), "collisions.json");

const getCachedAtPath = (branch: string, subpath: string): string =>
    path.join(getSignatureCacheDir(branch, subpath), "cached_at.txt");

export const isSignatureCacheFresh = (branch: string, subpath: string, skipCacheChecks: boolean): boolean => {
    const atPath = getCachedAtPath(branch, subpath);
    const filePath = getSignatureCacheFilePath(branch, subpath);
    if (!fs.existsSync(atPath) || !fs.existsSync(filePath)) return false;
    if (skipCacheChecks) return true;
    try {
        const ts = parseInt(fs.readFileSync(atPath, "utf8").trim(), 10);
        if (isNaN(ts)) return false;
        return Date.now() - ts <= ONE_WEEK_MS;
    } catch {
        return false;
    }
};

export const loadCachedSignature = (branch: string, subpath: string): CollisionRecord[] | null => {
    const filePath = getSignatureCacheFilePath(branch, subpath);
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8")) as CollisionRecord[];
    } catch {
        return null;
    }
};

export const saveSignatureToCache = (
    branch: string,
    subpath: string,
    records: CollisionRecord[],
    maxCacheSizeMb: number
): void => {
    const dir = getSignatureCacheDir(branch, subpath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "collisions.json"), JSON.stringify(records));
    fs.writeFileSync(path.join(dir, "cached_at.txt"), String(Date.now()));
    runEvictionIfNeeded(maxCacheSizeMb);
};

// --- Cache size & eviction ---

// Recursively sums sizes of all files under dir. Returns bytes.
const getDirSizeBytes = (dir: string): number => {
    if (!fs.existsSync(dir)) return 0;
    let total = 0;
    const walk = (d: string): void => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else {
                try {
                    total += fs.statSync(full).size;
                } catch {
                    // ignore
                }
            }
        }
    };
    walk(dir);
    return total;
};

export const getCacheDirSizeMb = (): number =>
    getDirSizeBytes(getSignatureCacheRoot()) / (1024 * 1024);

// Deletes oldest cached entries until the cache dir is below 50% of maxSizeMb.
export const runEvictionIfNeeded = (maxSizeMb: number): void => {
    const root = getSignatureCacheRoot();
    if (!fs.existsSync(root)) return;

    const currentMb = getCacheDirSizeMb();
    if (currentMb <= maxSizeMb) return;

    // Collect all cached_at.txt files with their timestamps.
    type Entry = { cachedAt: number; dir: string };
    const entries: Entry[] = [];
    const walkForCachedAt = (d: string): void => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) {
                walkForCachedAt(full);
            } else if (entry.name === "cached_at.txt") {
                try {
                    const ts = parseInt(fs.readFileSync(full, "utf8").trim(), 10);
                    if (!isNaN(ts)) entries.push({ cachedAt: ts, dir: path.dirname(full) });
                } catch {
                    // ignore
                }
            }
        }
    };
    walkForCachedAt(root);

    // Sort oldest first.
    entries.sort((a, b) => a.cachedAt - b.cachedAt);

    const targetMb = maxSizeMb * 0.5;
    for (const { dir } of entries) {
        if (getCacheDirSizeMb() <= targetMb) break;
        try {
            fs.rmSync(dir, { recursive: true, force: true });
        } catch {
            // ignore
        }
    }
};

// --- Cache validation ---

// Returns an array of warning strings describing structural issues.
// Empty array = all clear.
export const validateCaches = (): string[] => {
    const warnings: string[] = [];

    // Validate list cache structure if it exists.
    const listCachePath = getListCachePath();
    if (fs.existsSync(listCachePath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(listCachePath, "utf8")) as unknown;
            if (typeof raw !== "object" || raw === null) {
                warnings.push("cs-mast-s-list-cache.json: invalid JSON structure");
            } else {
                const c = raw as Record<string, unknown>;
                if (typeof c.generatedAt !== "number")
                    warnings.push("cs-mast-s-list-cache.json: missing or invalid generatedAt");
                if (typeof c.branches !== "object" || c.branches === null)
                    warnings.push("cs-mast-s-list-cache.json: missing or invalid branches");
            }
        } catch {
            warnings.push("cs-mast-s-list-cache.json: could not parse JSON");
        }
    }

    // Spot-check a sample of cached collisions.json files.
    const root = getSignatureCacheRoot();
    if (fs.existsSync(root)) {
        const walkForCollisions = (d: string, depth: number, found: string[]): void => {
            if (depth > 5 || found.length >= 5) return;
            for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
                const full = path.join(d, entry.name);
                if (entry.isDirectory()) walkForCollisions(full, depth + 1, found);
                else if (entry.name === "collisions.json") found.push(full);
            }
        };
        const samples: string[] = [];
        walkForCollisions(root, 0, samples);
        for (const p of samples) {
            try {
                const arr = JSON.parse(fs.readFileSync(p, "utf8")) as unknown;
                if (!Array.isArray(arr)) {
                    warnings.push(`${p}: cached collisions.json is not an array`);
                }
            } catch {
                warnings.push(`${p}: could not parse cached collisions.json`);
            }
        }
    }

    return warnings;
};
