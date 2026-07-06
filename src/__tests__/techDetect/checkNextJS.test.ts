import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { checkNextJS } from "../../lazyLoad/techDetect/checkNextJS.js";

const $ = (html: string) => cheerio.load(html);

describe("checkNextJS", () => {
    it("detects script#__NEXT_DATA__", async () => {
        const result = await checkNextJS($(
            `<html><head></head><body><script id="__NEXT_DATA__" type="application/json">{}</script></body></html>`
        ));
        expect(result.detected).toBe(true);
        expect(result.evidence).toContain("__NEXT_DATA__");
    });

    it("detects /_next/ in script src", async () => {
        const result = await checkNextJS($(
            `<html><head><script src="/_next/static/chunks/main.js"></script></head></html>`
        ));
        expect(result.detected).toBe(true);
        expect(result.evidence).toContain("/_next/");
    });

    it("detects /_next/ in link href", async () => {
        const result = await checkNextJS($(
            `<html><head><link rel="preload" href="/_next/static/css/main.css"></head></html>`
        ));
        expect(result.detected).toBe(true);
    });

    it("does not detect Next.js in plain HTML", async () => {
        const result = await checkNextJS($(
            `<html><head><script src="/static/js/app.js"></script></head></html>`
        ));
        expect(result.detected).toBe(false);
        expect(result.evidence).toBe("");
    });

    it("does not detect Next.js in Vue app HTML", async () => {
        const result = await checkNextJS($(
            `<html><head><script src="/assets/app.js"></script></head><body data-v-app></body></html>`
        ));
        expect(result.detected).toBe(false);
    });
});
