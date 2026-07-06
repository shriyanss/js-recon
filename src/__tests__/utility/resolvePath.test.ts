import { describe, it, expect } from "vitest";
import resolvePath from "../../utility/resolvePath.js";

describe("resolvePath", () => {
    it("resolves ./ relative to base without trailing slash (treats last segment as file)", () => {
        expect(resolvePath("https://site.com/something", "./main.js")).toBe(
            "https://site.com/main.js"
        );
    });

    it("resolves ./ relative to base with trailing slash", () => {
        expect(resolvePath("https://site.com/something/", "./main.js")).toBe(
            "https://site.com/something/main.js"
        );
    });

    it("resolves ../ navigating up one level", () => {
        expect(resolvePath("https://site.com/something/other", "../main.js")).toBe(
            "https://site.com/main.js"
        );
    });

    it("resolves absolute path against origin", () => {
        expect(resolvePath("https://site.com/deep/nested/path", "/static/js/app.js")).toBe(
            "https://site.com/static/js/app.js"
        );
    });

    it("resolves simple filename relative to directory", () => {
        expect(resolvePath("https://cdn.example.com/assets/", "chunk.abc123.js")).toBe(
            "https://cdn.example.com/assets/chunk.abc123.js"
        );
    });

    it("preserves query string on the resolved path", () => {
        const result = resolvePath("https://site.com/app/", "./data.js?v=1");
        expect(result).toBe("https://site.com/app/data.js?v=1");
    });

    it("throws on an invalid relative path that cannot resolve", () => {
        expect(() => resolvePath("not-a-url", "also-not-a-url")).toThrow();
    });
});
