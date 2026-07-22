import { describe, it, expect } from "vitest";
import { isValidInterceptedJsEvidence } from "../../lazyLoad/techDetect/checkInterceptedEvidence.js";

describe("isValidInterceptedJsEvidence", () => {
    it("accepts a 2xx response with a genuine JS content-type and body", () => {
        expect(isValidInterceptedJsEvidence(200, "text/javascript", "console.log('chunk');")).toBe(true);
    });

    it("accepts legacy JS MIME variants", () => {
        expect(isValidInterceptedJsEvidence(200, "application/javascript", "var x = 1;")).toBe(true);
    });

    it("rejects a non-2xx status even with a JS content-type", () => {
        expect(
            isValidInterceptedJsEvidence(500, "text/javascript", "Your request could not be processed.")
        ).toBe(false);
    });

    it("rejects a non-JS content-type", () => {
        expect(isValidInterceptedJsEvidence(200, "text/html", "<html><body>error</body></html>")).toBe(false);
        expect(isValidInterceptedJsEvidence(200, "text/plain", "Please try again later.")).toBe(false);
    });

    it("rejects an HTML-shaped body even when the content-type claims JS", () => {
        expect(isValidInterceptedJsEvidence(200, "text/javascript", "<!DOCTYPE html><html></html>")).toBe(false);
        expect(isValidInterceptedJsEvidence(200, "text/javascript", "<html><body>error</body></html>")).toBe(
            false
        );
    });

    it("rejects a missing content-type", () => {
        expect(isValidInterceptedJsEvidence(200, null, "console.log(1);")).toBe(false);
        expect(isValidInterceptedJsEvidence(200, undefined, "console.log(1);")).toBe(false);
    });
});
