import { describe, it, expect } from "vitest";
import { isJsContentType } from "../../lazyLoad/generic/generic_jsMimeTypes.js";

describe("isJsContentType", () => {
    it("accepts the RFC 9239 current type", () => {
        expect(isJsContentType("text/javascript")).toBe(true);
    });

    it("accepts RFC 4329 obsoleted-but-still-seen types", () => {
        expect(isJsContentType("application/javascript")).toBe(true);
        expect(isJsContentType("application/ecmascript")).toBe(true);
    });

    it("accepts legacy variants", () => {
        expect(isJsContentType("text/ecmascript")).toBe(true);
        expect(isJsContentType("application/x-javascript")).toBe(true);
        expect(isJsContentType("text/x-javascript")).toBe(true);
        expect(isJsContentType("text/jscript")).toBe(true);
    });

    it("is case-insensitive", () => {
        expect(isJsContentType("Text/JavaScript")).toBe(true);
    });

    it("strips charset and other params", () => {
        expect(isJsContentType("text/javascript; charset=utf-8")).toBe(true);
    });

    it("rejects non-JS types", () => {
        expect(isJsContentType("text/html")).toBe(false);
        expect(isJsContentType("text/css")).toBe(false);
        expect(isJsContentType("application/json")).toBe(false);
    });

    it("rejects null/undefined/empty", () => {
        expect(isJsContentType(null)).toBe(false);
        expect(isJsContentType(undefined)).toBe(false);
        expect(isJsContentType("")).toBe(false);
    });
});
