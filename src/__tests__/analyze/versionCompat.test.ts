import { describe, it, expect } from "vitest";
import { parseVersion, compareVersions, isVersionCompatible } from "../../analyze/helpers/validate.js";

describe("parseVersion", () => {
    it("parses a stable version", () => {
        expect(parseVersion("1.3.1")).toEqual([1, 3, 1]);
    });

    it("strips prerelease suffix", () => {
        expect(parseVersion("1.3.1-alpha.3")).toEqual([1, 3, 1]);
    });

    it("parses major-only version by padding zeros", () => {
        expect(parseVersion("2.0.0")).toEqual([2, 0, 0]);
    });
});

describe("compareVersions", () => {
    it("returns 0 for equal versions", () => {
        expect(compareVersions([1, 3, 1], [1, 3, 1])).toBe(0);
    });

    it("returns positive when first is greater (patch)", () => {
        expect(compareVersions([1, 3, 2], [1, 3, 1])).toBeGreaterThan(0);
    });

    it("returns negative when first is less (minor)", () => {
        expect(compareVersions([1, 2, 0], [1, 3, 0])).toBeLessThan(0);
    });

    it("returns positive when major differs", () => {
        expect(compareVersions([2, 0, 0], [1, 9, 9])).toBeGreaterThan(0);
    });
});

describe("isVersionCompatible", () => {
    it(">= passes when current equals required", () => {
        expect(isVersionCompatible(">=1.3.0", "1.3.0")).toBe(true);
    });

    it(">= passes when current is newer", () => {
        expect(isVersionCompatible(">=1.3.0", "1.4.1")).toBe(true);
    });

    it(">= fails when current is older", () => {
        expect(isVersionCompatible(">=1.4.0", "1.3.1")).toBe(false);
    });

    it("> passes when current is strictly newer", () => {
        expect(isVersionCompatible(">1.3.0", "1.3.1")).toBe(true);
    });

    it("> fails when current equals required", () => {
        expect(isVersionCompatible(">1.3.0", "1.3.0")).toBe(false);
    });

    it("<= passes when current equals required", () => {
        expect(isVersionCompatible("<=1.3.0", "1.3.0")).toBe(true);
    });

    it("<= passes when current is older", () => {
        expect(isVersionCompatible("<=1.4.0", "1.3.0")).toBe(true);
    });

    it("<= fails when current is newer", () => {
        expect(isVersionCompatible("<=1.3.0", "1.4.0")).toBe(false);
    });

    it("< passes when current is strictly older", () => {
        expect(isVersionCompatible("<1.4.0", "1.3.9")).toBe(true);
    });

    it("< fails when current equals required", () => {
        expect(isVersionCompatible("<1.3.0", "1.3.0")).toBe(false);
    });

    it("= passes for exact match", () => {
        expect(isVersionCompatible("=1.3.0", "1.3.0")).toBe(true);
    });

    it("= fails when versions differ", () => {
        expect(isVersionCompatible("=1.3.0", "1.3.1")).toBe(false);
    });

    it("== passes for exact match", () => {
        expect(isVersionCompatible("==1.3.0", "1.3.0")).toBe(true);
    });

    it("strips prerelease suffix when comparing", () => {
        expect(isVersionCompatible(">=1.3.0", "1.3.1-alpha.5")).toBe(true);
    });

    it("returns false for malformed requirement", () => {
        expect(isVersionCompatible("INVALID", "1.3.0")).toBe(false);
    });
});
