import { describe, it, expect } from "vitest";
import { validateRefactorConfig } from "../../refactor/remote/config.js";
import type { RefactorConfig } from "../../refactor/remote/config.js";

describe("validateRefactorConfig", () => {
    it("returns no warnings for a valid config", () => {
        const cfg: RefactorConfig = { maxCacheSizeMb: 512 };
        expect(validateRefactorConfig(cfg)).toHaveLength(0);
    });

    it("returns a warning when maxCacheSizeMb is zero", () => {
        const cfg: RefactorConfig = { maxCacheSizeMb: 0 };
        const warnings = validateRefactorConfig(cfg);
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings[0]).toContain("maxCacheSizeMb");
    });

    it("returns a warning when maxCacheSizeMb is negative", () => {
        const cfg: RefactorConfig = { maxCacheSizeMb: -1 };
        const warnings = validateRefactorConfig(cfg);
        expect(warnings.length).toBeGreaterThan(0);
    });

    it("returns a warning when maxCacheSizeMb is not a number", () => {
        const cfg = { maxCacheSizeMb: "not-a-number" } as unknown as RefactorConfig;
        const warnings = validateRefactorConfig(cfg);
        expect(warnings.length).toBeGreaterThan(0);
    });

    it("accepts any positive maxCacheSizeMb value", () => {
        expect(validateRefactorConfig({ maxCacheSizeMb: 1 })).toHaveLength(0);
        expect(validateRefactorConfig({ maxCacheSizeMb: 10240 })).toHaveLength(0);
    });
});
