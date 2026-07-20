import { describe, it, expect } from "vitest";
import { findJsPathSegmentCandidates } from "../../lazyLoad/generic/generic_scanAttributesForJs.js";

describe("findJsPathSegmentCandidates", () => {
    it("finds a normal trailing .js URL", () => {
        const html = `<a href="/a/b.js">link</a>`;
        const result = findJsPathSegmentCandidates(html, "https://example.com");
        expect(result).toEqual(["https://example.com/a/b.js"]);
    });

    it("finds a .js path segment that is not the final segment (cachebuster shape)", () => {
        const html = `<script data-src="/beacon.min.js/v124/token"></script>`;
        const result = findJsPathSegmentCandidates(html, "https://example.com");
        expect(result).toEqual(["https://example.com/beacon.min.js/v124/token"]);
    });

    it("ignores URLs with no .js anywhere in the path", () => {
        const html = `<img src="/images/logo.png"><a href="/about">About</a>`;
        const result = findJsPathSegmentCandidates(html, "https://example.com");
        expect(result).toEqual([]);
    });

    it("does not throw on unparseable attribute values and excludes them", () => {
        const html = `<div data-foo="not a url at all :::">test</div>`;
        expect(() => findJsPathSegmentCandidates(html, "https://example.com")).not.toThrow();
        expect(findJsPathSegmentCandidates(html, "https://example.com")).toEqual([]);
    });

    it("dedupes repeated candidates", () => {
        const html = `<a href="/a.js">one</a><a href="/a.js">two</a>`;
        const result = findJsPathSegmentCandidates(html, "https://example.com");
        expect(result).toEqual(["https://example.com/a.js"]);
    });

    it("is case-insensitive on the .js suffix", () => {
        const html = `<a href="/a/B.JS">link</a>`;
        const result = findJsPathSegmentCandidates(html, "https://example.com");
        expect(result).toEqual(["https://example.com/a/B.JS"]);
    });
});
