import { describe, it, expect } from "vitest";
import {
    isListCacheStale,
    shouldRefreshListCache,
    getSignatureCacheFilePath,
    isCacheContentStale,
} from "../../refactor/remote/cache.js";
import type { ListCache } from "../../refactor/remote/cache.js";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

describe("isListCacheStale", () => {
    it("returns false for a cache generated just now", () => {
        const fresh: ListCache = { generatedAt: Date.now() - 1000, branches: {} };
        expect(isListCacheStale(fresh)).toBe(false);
    });

    it("returns true for a cache generated more than 7 days ago", () => {
        const stale: ListCache = { generatedAt: Date.now() - ONE_WEEK_MS - 1000, branches: {} };
        expect(isListCacheStale(stale)).toBe(true);
    });

    it("returns false for a cache generated exactly at the 7-day boundary minus one second", () => {
        const borderFresh: ListCache = { generatedAt: Date.now() - ONE_WEEK_MS + 5000, branches: {} };
        expect(isListCacheStale(borderFresh)).toBe(false);
    });
});

describe("shouldRefreshListCache", () => {
    const freshCache: ListCache = { generatedAt: Date.now() - 1000, branches: {} };
    const staleCache: ListCache = { generatedAt: Date.now() - ONE_WEEK_MS - 1000, branches: {} };

    it("returns true when refreshCache flag is set, regardless of cache state", () => {
        expect(shouldRefreshListCache(freshCache, { refreshCache: true, skipCacheChecks: false })).toBe(true);
    });

    it("returns true when cache is null", () => {
        expect(shouldRefreshListCache(null, { refreshCache: false, skipCacheChecks: false })).toBe(true);
    });

    it("returns true when cache is stale and skipCacheChecks is false", () => {
        expect(shouldRefreshListCache(staleCache, { refreshCache: false, skipCacheChecks: false })).toBe(true);
    });

    it("returns false when cache is stale but skipCacheChecks is true", () => {
        expect(shouldRefreshListCache(staleCache, { refreshCache: false, skipCacheChecks: true })).toBe(false);
    });

    it("returns false when cache is fresh and no flags are set", () => {
        expect(shouldRefreshListCache(freshCache, { refreshCache: false, skipCacheChecks: false })).toBe(false);
    });
});

describe("getSignatureCacheFilePath", () => {
    it("returns a path ending with collisions.json", () => {
        const p = getSignatureCacheFilePath("react/webpack/large-0.1.8", "01-feat/lit-decl-loop-cond/collisions.json");
        expect(p.endsWith("collisions.json")).toBe(true);
    });

    it("embeds the branch and stripped subpath in the returned path", () => {
        const p = getSignatureCacheFilePath("react/webpack/large-0.1.8", "01-feat/lit-decl-loop-cond/collisions.json");
        expect(p).toContain("signature_cache");
        expect(p).toContain("01-feat");
        expect(p).toContain("lit-decl-loop-cond");
    });

    it("does not double the collisions.json suffix", () => {
        const p = getSignatureCacheFilePath("react/webpack/large-0.1.8", "feat/scat/collisions.json");
        const occurrences = p.split("collisions.json").length - 1;
        expect(occurrences).toBe(1);
    });
});

describe("isCacheContentStale", () => {
    it("returns false when the remote hash is unknown (can't prove staleness)", () => {
        expect(isCacheContentStale("abc123", null)).toBe(false);
        expect(isCacheContentStale(null, null)).toBe(false);
    });

    it("returns true when the cached hash differs from the current remote hash", () => {
        expect(isCacheContentStale("abc123", "def456")).toBe(true);
    });

    it("returns true when there is no cached hash yet but a remote hash is known", () => {
        expect(isCacheContentStale(null, "def456")).toBe(true);
    });

    it("returns false when the cached hash matches the current remote hash", () => {
        expect(isCacheContentStale("abc123", "abc123")).toBe(false);
    });
});
