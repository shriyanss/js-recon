import { describe, it, expect } from "vitest";
import { scatToDir } from "../../refactor/index.js";

describe("scatToDir", () => {
    it("reorders inputs to canonical category order", () => {
        expect(scatToDir(["cond", "lit", "loop", "decl"])).toBe("lit-decl-loop-cond");
    });

    it("handles a single recognised category", () => {
        expect(scatToDir(["cond"])).toBe("cond");
    });

    it("handles all nine canonical categories supplied in reverse order", () => {
        const canonical = ["lit", "id", "op", "decl", "loop", "cond", "name", "val", "op_name"];
        expect(scatToDir([...canonical].reverse())).toBe(canonical.join("-"));
    });

    it("falls back to input join when no category matches the canonical list", () => {
        expect(scatToDir(["custom1", "custom2"])).toBe("custom1-custom2");
    });

    it("filters out unrecognised categories and keeps known ones in canonical order", () => {
        expect(scatToDir(["decl", "unknown", "lit"])).toBe("lit-decl");
    });

    it("produces the react-webpack baseline scat dir", () => {
        expect(scatToDir(["lit", "decl", "loop", "cond"])).toBe("lit-decl-loop-cond");
    });

    it("handles duplicate entries without doubling the output", () => {
        expect(scatToDir(["lit", "lit", "decl"])).toBe("lit-decl");
    });
});
