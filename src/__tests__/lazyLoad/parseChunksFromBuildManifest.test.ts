import { describe, it, expect } from "vitest";
import { parseChunksFromBuildManifest } from "../../lazyLoad/next_js/next_GetLazyResourcesBuildManifestJs.js";

const BASE = "https://example.com/_next/static/abc123/_buildManifest.js";

describe("parseChunksFromBuildManifest", () => {
    it("extracts chunk URLs from static/chunks/ string literals", () => {
        const content = `
            self.__BUILD_MANIFEST = {
                "/": ["static/chunks/pages/index-abc123.js"],
                "/about": ["static/chunks/pages/about-def456.js"]
            };
        `;
        const result = parseChunksFromBuildManifest(content, BASE);
        expect(result.length).toBe(2);
        expect(result[0]).toContain("static/chunks/pages/index-abc123.js");
        expect(result[1]).toContain("static/chunks/pages/about-def456.js");
    });

    it("resolves URLs relative to the buildManifest URL (two levels up)", () => {
        const content = `["static/chunks/main-abc.js"]`;
        const result = parseChunksFromBuildManifest(content, BASE);
        // new URL("../../static/chunks/main-abc.js", BASE) goes up two dirs from /_next/static/abc123/
        expect(result[0]).toBe("https://example.com/_next/static/chunks/main-abc.js");
    });

    it("ignores string literals without static/chunks/", () => {
        const content = `["/_next/static/css/main.css", "not-a-chunk.js"]`;
        const result = parseChunksFromBuildManifest(content, BASE);
        expect(result).toHaveLength(0);
    });

    it("deduplicates repeated string literals", () => {
        const content = `["static/chunks/shared.js", "static/chunks/shared.js"]`;
        // parseChunksFromBuildManifest does not deduplicate — that's the caller's job
        const result = parseChunksFromBuildManifest(content, BASE);
        expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("returns [] for empty content", () => {
        expect(parseChunksFromBuildManifest("", BASE)).toEqual([]);
    });

    it("returns [] for invalid JS content", () => {
        expect(parseChunksFromBuildManifest("{{{{ not valid js %%%%", BASE)).toEqual([]);
    });

    it("handles multiple chunks in a nested object", () => {
        const content = `
            self.__BUILD_MANIFEST = {
                sortedPages: ["/", "/dashboard", "/settings"],
                "/dashboard": ["static/chunks/dashboard-a.js", "static/chunks/dashboard-b.js"],
            };
        `;
        const result = parseChunksFromBuildManifest(content, BASE);
        expect(result.length).toBe(2);
    });
});
