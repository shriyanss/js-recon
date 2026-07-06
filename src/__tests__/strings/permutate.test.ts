import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import permutate from "../../strings/permutate.js";

const tmpFile = path.join(os.tmpdir(), `jsr-permutate-test-${process.pid}`);

afterEach(() => {
    const txtPath = `${tmpFile}.txt`;
    if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
});

describe("permutate", () => {
    it("writes a .txt file at the given output path", async () => {
        await permutate(["https://example.com/page"], ["/api/users"], tmpFile);
        expect(fs.existsSync(`${tmpFile}.txt`)).toBe(true);
    });

    it("combines base URL origin with each path", async () => {
        await permutate(["https://example.com/page"], ["/api/v1"], tmpFile);
        const content = fs.readFileSync(`${tmpFile}.txt`, "utf8");
        expect(content).toContain("https://example.com/api/v1");
    });

    it("appends the original URL to the output", async () => {
        await permutate(["https://example.com/page"], ["/api/v1"], tmpFile);
        const content = fs.readFileSync(`${tmpFile}.txt`, "utf8");
        expect(content).toContain("https://example.com/page");
    });

    it("appends the origin (base URL) to the output", async () => {
        await permutate(["https://example.com/page"], ["/api/v1"], tmpFile);
        const content = fs.readFileSync(`${tmpFile}.txt`, "utf8");
        expect(content).toContain("https://example.com");
    });

    it("deduplicates identical entries", async () => {
        await permutate(
            ["https://example.com/"],
            ["/api/users"],
            tmpFile
        );
        const content = fs.readFileSync(`${tmpFile}.txt`, "utf8");
        const lines = content.split("\n").filter((l) => l.length > 0);
        const unique = new Set(lines);
        expect(lines.length).toBe(unique.size);
    });

    it("skips invalid (non-URL) entries in the urls array", async () => {
        await permutate(["not-a-url", "https://valid.com/"], ["/path"], tmpFile);
        const content = fs.readFileSync(`${tmpFile}.txt`, "utf8");
        expect(content).not.toContain("not-a-url/path");
        expect(content).toContain("https://valid.com/path");
    });

    it("produces output for multiple URLs and paths", async () => {
        await permutate(
            ["https://a.example.com/", "https://b.example.com/"],
            ["/api/users", "/api/posts"],
            tmpFile
        );
        const content = fs.readFileSync(`${tmpFile}.txt`, "utf8");
        expect(content).toContain("https://a.example.com/api/users");
        expect(content).toContain("https://a.example.com/api/posts");
        expect(content).toContain("https://b.example.com/api/users");
        expect(content).toContain("https://b.example.com/api/posts");
    });

    it("handles empty paths array — only original URLs written", async () => {
        await permutate(["https://example.com/page"], [], tmpFile);
        const content = fs.readFileSync(`${tmpFile}.txt`, "utf8");
        expect(content).toContain("https://example.com/page");
    });

    it("handles empty urls array — writes nothing meaningful", async () => {
        await permutate([], ["/api/users"], tmpFile);
        const content = fs.readFileSync(`${tmpFile}.txt`, "utf8");
        expect(content.trim()).toBe("");
    });
});
