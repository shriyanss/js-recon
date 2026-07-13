import { describe, it, expect } from "vitest";
import { parseJSFileContent as nuxtParseJSFileContent } from "../../lazyLoad/nuxt_js/nuxt_stringAnalysisJSFiles.js";
import { parseJSFileContent as svelteParseJSFileContent } from "../../lazyLoad/svelte/svelte_stringAnalysisJSFiles.js";

const IMPLEMENTATIONS = [
    { name: "nuxt", fn: nuxtParseJSFileContent },
    { name: "svelte", fn: svelteParseJSFileContent },
] as const;

for (const { name, fn } of IMPLEMENTATIONS) {
    describe(`parseJSFileContent (${name})`, () => {
        it("finds .js string literals with ./ prefix", async () => {
            const code = `const x = "./chunk.abc123.js";`;
            const result = await fn(code);
            expect(result).toHaveProperty("./chunk.abc123.js");
        });

        it("finds .js string literals with ../ prefix", async () => {
            const code = `import "./foo/../bar.js"; const x = "../vendor.js";`;
            const result = await fn(code);
            expect(result).toHaveProperty("../vendor.js");
        });

        it("finds bare .js strings without path prefix", async () => {
            const code = `const paths = ["runtime.js", "main.js"];`;
            const result = await fn(code);
            expect(result).toHaveProperty("runtime.js");
            expect(result).toHaveProperty("main.js");
        });

        it("ignores strings that do not end in .js", async () => {
            const code = `const x = "/api/data"; const y = "style.css";`;
            const result = await fn(code);
            expect(Object.keys(result)).toHaveLength(0);
        });

        it("deduplicates repeated .js references", async () => {
            const code = `const a = "./chunk.js"; const b = "./chunk.js";`;
            const result = await fn(code);
            expect(Object.keys(result)).toHaveLength(1);
        });

        it("returns {} for syntactically invalid code", async () => {
            const code = `this is not valid javascript {{{{`;
            const result = await fn(code);
            expect(result).toEqual({});
        });

        it("returns {} for empty string", async () => {
            const result = await fn("");
            expect(result).toEqual({});
        });

        it("handles multiple .js references in one file", async () => {
            const code = `
                const a = "./a.js";
                const b = "../b.js";
                const c = "vendor.js";
            `;
            const result = await fn(code);
            expect(Object.keys(result).length).toBeGreaterThanOrEqual(3);
        });
    });
}
