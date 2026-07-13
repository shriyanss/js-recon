import { describe, it, expect } from "vitest";
import { extractPromiseAllChunkPaths } from "../../lazyLoad/next_js/next_promiseResolve.js";

const DIR = "https://example.com/_next/static/chunks";

describe("extractPromiseAllChunkPaths", () => {
    it("extracts chunk paths from Promise.all([...].map(...)) pattern", () => {
        const jsContent = `
            Promise.all(["static/chunks/abc.js", "static/chunks/def.js"].map(require.bind(require)));
        `;
        const result = extractPromiseAllChunkPaths(jsContent, DIR);
        expect(result.length).toBe(2);
        expect(result[0]).toBe(DIR + "/abc.js");
        expect(result[1]).toBe(DIR + "/def.js");
    });

    it("strips static/chunks/ prefix and joins with jsDirBase", () => {
        const jsContent = `Promise.all(["static/chunks/page-about.js"].map(r.bind(r)));`;
        const result = extractPromiseAllChunkPaths(jsContent, DIR);
        expect(result[0]).toBe(`${DIR}/page-about.js`);
    });

    it("returns [] when no Promise.all pattern is present", () => {
        const jsContent = `const x = 1; function foo() {}`;
        expect(extractPromiseAllChunkPaths(jsContent, DIR)).toEqual([]);
    });

    it("returns [] for invalid JS", () => {
        expect(extractPromiseAllChunkPaths("{{{{ not valid %%%%", DIR)).toEqual([]);
    });

    it("returns [] for empty content", () => {
        expect(extractPromiseAllChunkPaths("", DIR)).toEqual([]);
    });

    it("ignores non-string elements inside the array", () => {
        const jsContent = `Promise.all([123, "static/chunks/valid.js"].map(r.bind(r)));`;
        const result = extractPromiseAllChunkPaths(jsContent, DIR);
        expect(result.length).toBe(1);
        expect(result[0]).toContain("valid.js");
    });

    it("handles multiple Promise.all calls in same file", () => {
        const jsContent = `
            Promise.all(["static/chunks/a.js"].map(r.bind(r)));
            Promise.all(["static/chunks/b.js"].map(r.bind(r)));
        `;
        const result = extractPromiseAllChunkPaths(jsContent, DIR);
        expect(result.length).toBe(2);
    });
});
