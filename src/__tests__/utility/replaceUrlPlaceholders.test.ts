import { describe, it, expect } from "vitest";
import replacePlaceholders from "../../utility/replaceUrlPlaceholders.js";

describe("replacePlaceholders", () => {
    it("replaces MemberExpression placeholder", () => {
        expect(replacePlaceholders("/api/[MemberExpression -> user.id]/profile")).toBe("/api/{user.id}/profile");
    });

    it("replaces [var name] placeholder", () => {
        expect(replacePlaceholders("/api/[var userId]/items")).toBe("/api/{userId}/items");
    });

    it("replaces [unresolved member expression] with indexed placeholder", () => {
        const result = replacePlaceholders("/api/[unresolved member expression]/data");
        expect(result).toBe("/api/{unres_mem_exp_1}/data");
    });

    it("increments count for multiple [unresolved member expression] occurrences", () => {
        const result = replacePlaceholders(
            "/[unresolved member expression]/path/[unresolved member expression]"
        );
        expect(result).toBe("/{unres_mem_exp_1}/path/{unres_mem_exp_2}");
    });

    it("replaces [unresolved: varName] placeholder", () => {
        expect(replacePlaceholders("/api/[unresolved: configBase]/endpoint")).toBe(
            "/api/{configBase}/endpoint"
        );
    });

    it("handles URL with no placeholders unchanged", () => {
        expect(replacePlaceholders("/api/v1/users")).toBe("/api/v1/users");
    });

    it("handles multiple different placeholder types in one URL", () => {
        const result = replacePlaceholders(
            "/[MemberExpression -> a.b]/[var x]/[unresolved: y]"
        );
        expect(result).toBe("/{a.b}/{x}/{y}");
    });

    it("returns empty string unchanged", () => {
        expect(replacePlaceholders("")).toBe("");
    });
});
