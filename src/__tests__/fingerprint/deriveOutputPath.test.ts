import { describe, it, expect } from "vitest";
import { deriveOutputPath } from "../../fingerprint/index.js";

describe("deriveOutputPath", () => {
    it("appends .txt for text format", () => {
        expect(deriveOutputPath("results", "text")).toBe("results.txt");
    });

    it("appends .csv for csv format", () => {
        expect(deriveOutputPath("results", "csv")).toBe("results.csv");
    });

    it("appends .json for json format", () => {
        expect(deriveOutputPath("results", "json")).toBe("results.json");
    });

    it("appends .jsonl for jsonl format", () => {
        expect(deriveOutputPath("results", "jsonl")).toBe("results.jsonl");
    });

    it("replaces an existing extension with the format extension", () => {
        expect(deriveOutputPath("results.txt", "json")).toBe("results.json");
    });

    it("handles a path with directory prefix", () => {
        expect(deriveOutputPath("/tmp/output/results", "csv")).toBe("/tmp/output/results.csv");
    });

    it("handles a path with directory prefix and existing extension", () => {
        expect(deriveOutputPath("/tmp/output/results.old", "jsonl")).toBe("/tmp/output/results.jsonl");
    });
});
