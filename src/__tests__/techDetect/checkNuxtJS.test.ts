import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { checkNuxtJS } from "../../lazyLoad/techDetect/checkNuxtJS.js";

const $ = (html: string) => cheerio.load(html);

describe("checkNuxtJS", () => {
    it("detects /_nuxt/ in script src", async () => {
        const result = await checkNuxtJS($(`<html><head><script src="/_nuxt/app.js"></script></head></html>`));
        expect(result.detected).toBe(true);
        expect(result.evidence).toContain("/_nuxt");
    });

    it("detects /_nuxt/ in link href", async () => {
        const result = await checkNuxtJS(
            $(`<html><head><link rel="modulepreload" href="/_nuxt/entry.mjs"></head></html>`)
        );
        expect(result.detected).toBe(true);
    });

    it("does not detect Nuxt in plain HTML", async () => {
        const result = await checkNuxtJS($(`<html><head><script src="/static/bundle.js"></script></head></html>`));
        expect(result.detected).toBe(false);
        expect(result.evidence).toBe("");
    });

    it("does not fire on /_next/ (Next.js path)", async () => {
        const result = await checkNuxtJS(
            $(`<html><head><script src="/_next/static/chunks/main.js"></script></head></html>`)
        );
        expect(result.detected).toBe(false);
    });
});
