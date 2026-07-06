import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { loadCollisionsFile } from "../../refactor/index.js";

const tmpDir = os.tmpdir();
const tmpFile = path.join(tmpDir, `jsr-collisions-test-${process.pid}.json`);

afterEach(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
});

describe("loadCollisionsFile", () => {
    it("returns a Set of signatures with the maximum count", () => {
        const records = [
            { signature: "$argon2id$v=19$sig1", count: 10 },
            { signature: "$argon2id$v=19$sig2", count: 10 },
            { signature: "$argon2id$v=19$sig3", count: 5 },
        ];
        fs.writeFileSync(tmpFile, JSON.stringify(records));
        const result = loadCollisionsFile(tmpFile);
        expect(result.has("$argon2id$v=19$sig1")).toBe(true);
        expect(result.has("$argon2id$v=19$sig2")).toBe(true);
        expect(result.has("$argon2id$v=19$sig3")).toBe(false);
    });

    it("returns all signatures when all have the same count", () => {
        const records = [
            { signature: "sigA", count: 3 },
            { signature: "sigB", count: 3 },
        ];
        fs.writeFileSync(tmpFile, JSON.stringify(records));
        const result = loadCollisionsFile(tmpFile);
        expect(result.size).toBe(2);
    });

    it("returns a single signature when only one has max count", () => {
        const records = [
            { signature: "sigA", count: 7 },
            { signature: "sigB", count: 2 },
            { signature: "sigC", count: 1 },
        ];
        fs.writeFileSync(tmpFile, JSON.stringify(records));
        const result = loadCollisionsFile(tmpFile);
        expect(result.size).toBe(1);
        expect(result.has("sigA")).toBe(true);
    });

    it("returns empty Set for empty records array", () => {
        fs.writeFileSync(tmpFile, JSON.stringify([]));
        const result = loadCollisionsFile(tmpFile);
        expect(result.size).toBe(0);
    });
});
