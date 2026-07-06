import { describe, it, expect } from "vitest";
import { scatToDir } from "../../refactor/index.js";

describe("scatToDir", () => {
    it("produces canonical order for standard categories", () => {
        expect(scatToDir(["lit", "decl", "loop", "cond"])).toBe("lit-decl-loop-cond");
    });

    it("reorders user-supplied categories to canonical order", () => {
        // cond, lit supplied in reverse — output should be canonical (lit first)
        expect(scatToDir(["cond", "lit"])).toBe("lit-cond");
    });

    it("handles a single category", () => {
        expect(scatToDir(["lit"])).toBe("lit");
    });

    it("handles all canonical categories in order", () => {
        const allCats = ["lit", "id", "op", "decl", "loop", "cond", "name", "val", "op_name"];
        expect(scatToDir(allCats)).toBe(allCats.join("-"));
    });

    it("falls back to original join when input contains unknown category", () => {
        // Unknown cats are filtered out by the canonical filter, but non-canonical
        // inputs that have NO known categories fall back to scat.join('-')
        expect(scatToDir(["unknown"])).toBe("unknown");
    });

    it("ignores duplicate categories (Set deduplication)", () => {
        expect(scatToDir(["lit", "lit", "decl"])).toBe("lit-decl");
    });
});
