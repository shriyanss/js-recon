import { describe, it, expect } from "vitest";
import { getHfRawUrl, getHfApiTreeUrl, HF_BUCKET, TECH_TO_BRANCH } from "../../refactor/remote/hf-client.js";

describe("getHfRawUrl", () => {
    it("returns a URL pointing to the HuggingFace bucket resolve endpoint", () => {
        const url = getHfRawUrl("react/webpack/large", "collisions.json");
        expect(url).toContain("huggingface.co");
        expect(url).toContain("buckets");
        expect(url).toContain(HF_BUCKET);
    });

    it("URL-encodes the full path (prefix/subpath) as one component", () => {
        const prefix = "react/webpack/large";
        const subpath = "01-feat/collisions.json";
        const url = getHfRawUrl(prefix, subpath);
        expect(url).toContain(encodeURIComponent(`${prefix}/${subpath}`));
    });

    it("includes 'resolve' in the URL path", () => {
        const url = getHfRawUrl("some/prefix", "file.json");
        expect(url).toContain("/resolve/");
    });
});

describe("getHfApiTreeUrl", () => {
    it("returns a URL pointing to the HuggingFace tree API endpoint", () => {
        const url = getHfApiTreeUrl("react/webpack/large");
        expect(url).toContain("huggingface.co");
        expect(url).toContain("api/buckets");
        expect(url).toContain(HF_BUCKET);
    });

    it("URL-encodes the prefix", () => {
        const prefix = "react/webpack/large";
        const url = getHfApiTreeUrl(prefix);
        expect(url).toContain(encodeURIComponent(prefix));
    });

    it("includes 'tree' in the URL path", () => {
        const url = getHfApiTreeUrl("some/prefix");
        expect(url).toContain("/tree/");
    });
});

describe("TECH_TO_BRANCH", () => {
    it("maps react-webpack to a valid bucket prefix", () => {
        expect(TECH_TO_BRANCH["react-webpack"]).toBeTruthy();
        expect(TECH_TO_BRANCH["react-webpack"]).toContain("react");
    });

    it("maps react-vite to a valid bucket prefix", () => {
        expect(TECH_TO_BRANCH["react-vite"]).toBeTruthy();
        expect(TECH_TO_BRANCH["react-vite"]).toContain("react");
    });
});
