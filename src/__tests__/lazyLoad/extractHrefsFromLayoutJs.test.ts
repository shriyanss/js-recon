import { describe, it, expect } from "vitest";
import { extractHrefsFromLayoutJs } from "../../lazyLoad/next_js/next_parseLayoutJs.js";

describe("extractHrefsFromLayoutJs", () => {
    it("extracts a plain string href", () => {
        const code = `const nav = [{ href: "/about" }, { href: "/contact" }];`;
        const result = extractHrefsFromLayoutJs(code);
        expect(result).toContain("/about");
        expect(result).toContain("/contact");
    });

    it("extracts a template literal href", () => {
        const code = 'const base = "v1"; const item = { href: `/api/${base}/users` };';
        const result = extractHrefsFromLayoutJs(code);
        expect(result.some((h) => h.includes("/api/") && h.includes("/users"))).toBe(true);
    });

    it("extracts binary + concatenated href", () => {
        const code = `const item = { href: "/prefix" + "/suffix" };`;
        const result = extractHrefsFromLayoutJs(code);
        expect(result).toContain("/prefix/suffix");
    });

    it("extracts .concat() href", () => {
        const code = `const item = { href: "/base".concat("/path") };`;
        const result = extractHrefsFromLayoutJs(code);
        expect(result).toContain("/base/path");
    });

    it("returns [] when no href properties exist", () => {
        const code = `const item = { url: "/not-href" };`;
        expect(extractHrefsFromLayoutJs(code)).toEqual([]);
    });

    it("returns [] for empty content", () => {
        expect(extractHrefsFromLayoutJs("")).toEqual([]);
    });

    it("returns [] for invalid JS", () => {
        expect(extractHrefsFromLayoutJs("{{{{ not valid %%%%")).toEqual([]);
    });

    it("does not include identifier href values (placeholder returned for dynamic)", () => {
        // Identifier hrefs produce random placeholders — just verify extraction happened
        const code = `const item = { href: someVar };`;
        const result = extractHrefsFromLayoutJs(code);
        // One placeholder is pushed for the unknown identifier
        expect(result.length).toBe(1);
        expect(typeof result[0]).toBe("string");
    });

    it("collects hrefs from nested structures", () => {
        const code = `
            const links = [
                { href: "/home" },
                { items: [{ href: "/nested" }] }
            ];
        `;
        const result = extractHrefsFromLayoutJs(code);
        expect(result).toContain("/home");
        expect(result).toContain("/nested");
    });
});
