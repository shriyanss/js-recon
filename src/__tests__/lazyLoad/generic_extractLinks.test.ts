import { describe, it, expect } from "vitest";
import { extractPageLinks } from "../../lazyLoad/generic/generic_extractLinks.js";

describe("extractPageLinks", () => {
    it("resolves a relative link against the base URL", () => {
        const html = `<a href="/about">About</a>`;
        const result = extractPageLinks(html, "https://example.com");
        expect(result).toEqual(["https://example.com/about"]);
    });

    it("keeps absolute http(s) links unchanged", () => {
        const html = `<a href="https://example.com/contact">Contact</a>`;
        const result = extractPageLinks(html, "https://example.com");
        expect(result).toEqual(["https://example.com/contact"]);
    });

    it("ignores fragment-only links", () => {
        const html = `<a href="#top">Top</a>`;
        const result = extractPageLinks(html, "https://example.com");
        expect(result).toEqual([]);
    });

    it("strips the hash from a link with a path and a fragment", () => {
        const html = `<a href="/about#team">About</a>`;
        const result = extractPageLinks(html, "https://example.com");
        expect(result).toEqual(["https://example.com/about"]);
    });

    it("ignores mailto, tel, javascript, data, and blob links", () => {
        const html = `
            <a href="mailto:test@example.com">Mail</a>
            <a href="tel:+15551234567">Call</a>
            <a href="javascript:void(0)">JS</a>
            <a href="data:text/plain,hello">Data</a>
            <a href="blob:https://example.com/uuid">Blob</a>
        `;
        expect(extractPageLinks(html, "https://example.com")).toEqual([]);
    });

    it("does not throw on unparseable href values and excludes them", () => {
        const html = `<a href="http://[::1">bad</a>`;
        expect(() => extractPageLinks(html, "https://example.com")).not.toThrow();
        expect(extractPageLinks(html, "https://example.com")).toEqual([]);
    });

    it("dedupes repeated links", () => {
        const html = `<a href="/a">one</a><a href="/a">two</a>`;
        const result = extractPageLinks(html, "https://example.com");
        expect(result).toEqual(["https://example.com/a"]);
    });

    it("ignores links with no href attribute", () => {
        const html = `<a name="anchor">no href</a>`;
        expect(extractPageLinks(html, "https://example.com")).toEqual([]);
    });
});
