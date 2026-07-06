import { describe, it, expect } from "vitest";
import { shouldRunMethod, FRAMEWORK_METHODS, VALID_METHODS } from "../../lazyLoad/methodFilter.js";

describe("shouldRunMethod", () => {
    it("returns true when include and exclude are both empty", () => {
        expect(shouldRunMethod("next_GetJSScript", [], [])).toBe(true);
    });

    it("returns true when method is in include list", () => {
        expect(shouldRunMethod("next_GetJSScript", ["next_GetJSScript", "vue_RuntimeJs"], [])).toBe(true);
    });

    it("returns false when method is not in include list", () => {
        expect(shouldRunMethod("vue_RuntimeJs", ["next_GetJSScript"], [])).toBe(false);
    });

    it("returns false when method is in exclude list", () => {
        expect(shouldRunMethod("next_GetJSScript", [], ["next_GetJSScript"])).toBe(false);
    });

    it("returns true when method is not in exclude list", () => {
        expect(shouldRunMethod("vue_RuntimeJs", [], ["next_GetJSScript"])).toBe(true);
    });

    it("include list takes precedence over exclude list when include is non-empty", () => {
        expect(shouldRunMethod("next_GetJSScript", ["next_GetJSScript"], ["next_GetJSScript"])).toBe(true);
    });

    it("returns false for unknown method when include list is provided", () => {
        expect(shouldRunMethod("nonexistent_method", ["next_GetJSScript"], [])).toBe(false);
    });

    it("returns true for unknown method when exclude list does not contain it", () => {
        expect(shouldRunMethod("nonexistent_method", [], ["next_GetJSScript"])).toBe(true);
    });
});

describe("FRAMEWORK_METHODS", () => {
    it("contains entries for all supported frameworks", () => {
        const keys = Object.keys(FRAMEWORK_METHODS);
        expect(keys).toContain("next_js");
        expect(keys).toContain("vue");
        expect(keys).toContain("nuxt_js");
        expect(keys).toContain("svelte");
        expect(keys).toContain("angular");
        expect(keys).toContain("react");
    });

    it("each framework has at least one method", () => {
        for (const [framework, methods] of Object.entries(FRAMEWORK_METHODS)) {
            expect(methods.length, `${framework} should have at least 1 method`).toBeGreaterThan(0);
        }
    });
});

describe("VALID_METHODS", () => {
    it("is a flat union of all framework method arrays", () => {
        const allMethods = Object.values(FRAMEWORK_METHODS).flat();
        expect(VALID_METHODS).toEqual(allMethods);
    });

    it("contains well-known method names", () => {
        expect(VALID_METHODS).toContain("next_GetJSScript");
        expect(VALID_METHODS).toContain("vue_RuntimeJs");
        expect(VALID_METHODS).toContain("nuxt_astParse");
        expect(VALID_METHODS).toContain("svelte_stringAnalysisJSFiles");
        expect(VALID_METHODS).toContain("react_webpackChunkPaths");
    });
});
