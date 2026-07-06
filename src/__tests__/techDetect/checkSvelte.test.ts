import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { checkSvelte } from "../../lazyLoad/techDetect/checkSvelte.js";

const $ = (html: string) => cheerio.load(html);

describe("checkSvelte", () => {
    it("detects /_app/immutable/ in script src", async () => {
        const result = await checkSvelte(
            $(`<html><head><script src="/_app/immutable/entry/start.js"></script></head></html>`)
        );
        expect(result.detected).toBe(true);
        expect(result.evidence).toContain("/_app/immutable/");
    });

    it("detects /_app/immutable/ in link href", async () => {
        const result = await checkSvelte(
            $(`<html><head><link rel="modulepreload" href="/_app/immutable/chunks/runtime.js"></head></html>`)
        );
        expect(result.detected).toBe(true);
    });

    it("detects svelte- prefixed class name", async () => {
        const result = await checkSvelte($(`<html><body><div class="svelte-abc123">content</div></body></html>`));
        expect(result.detected).toBe(true);
        expect(result.evidence).toContain("svelte-");
    });

    it("detects data-sveltekit-* attribute", async () => {
        const result = await checkSvelte(
            $(`<html><body><a href="/about" data-sveltekit-reload>About</a></body></html>`)
        );
        expect(result.detected).toBe(true);
        expect(result.evidence).toContain("data-sveltekit-reload");
    });

    it("detects Astro+Svelte via renderer-url", async () => {
        const result = await checkSvelte(
            $(`<html><body><astro-island renderer-url="/@astro/svelte.js"></astro-island></body></html>`)
        );
        expect(result.detected).toBe(true);
    });

    it("does not detect Svelte in plain HTML", async () => {
        const result = await checkSvelte(
            $(
                `<html><head><script src="/bundle.js"></script></head><body><div class="container">hi</div></body></html>`
            )
        );
        expect(result.detected).toBe(false);
        expect(result.evidence).toBe("");
    });

    it("does not false-positive on /_next/ paths", async () => {
        const result = await checkSvelte(
            $(`<html><head><script src="/_next/static/chunks/main.js"></script></head></html>`)
        );
        expect(result.detected).toBe(false);
    });
});
