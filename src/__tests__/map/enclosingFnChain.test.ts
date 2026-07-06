import { describe, it, expect } from "vitest";
import { enclosingFnChainHasBinding } from "../../map/vue_js/taint_utils.js";
import type { EnclosingFn } from "../../map/vue_js/taint_utils.js";

function makeEnclosingFn(overrides: Partial<EnclosingFn> = {}): EnclosingFn {
    return {
        bindingName: null,
        firstParamName: null,
        paramNames: [],
        node: {},
        file: "test.ts",
        parent: null,
        ...overrides,
    };
}

describe("enclosingFnChainHasBinding", () => {
    it("returns false for null", () => {
        expect(enclosingFnChainHasBinding(null)).toBe(false);
    });

    it("returns false for undefined", () => {
        expect(enclosingFnChainHasBinding(undefined)).toBe(false);
    });

    it("returns true when the fn itself has a bindingName", () => {
        const fn = makeEnclosingFn({ bindingName: "myFn" });
        expect(enclosingFnChainHasBinding(fn)).toBe(true);
    });

    it("returns false when the fn has no bindingName and no parent", () => {
        const fn = makeEnclosingFn({ bindingName: null });
        expect(enclosingFnChainHasBinding(fn)).toBe(false);
    });

    it("returns true when a parent fn has a bindingName", () => {
        const parent = makeEnclosingFn({ bindingName: "outerFn" });
        const child = makeEnclosingFn({ bindingName: null, parent });
        expect(enclosingFnChainHasBinding(child)).toBe(true);
    });

    it("returns true when only a grandparent has a bindingName", () => {
        const grandparent = makeEnclosingFn({ bindingName: "rootFn" });
        const parent = makeEnclosingFn({ bindingName: null, parent: grandparent });
        const child = makeEnclosingFn({ bindingName: null, parent });
        expect(enclosingFnChainHasBinding(child)).toBe(true);
    });

    it("returns false when no fn in the chain has a bindingName", () => {
        const parent = makeEnclosingFn({ bindingName: null });
        const child = makeEnclosingFn({ bindingName: null, parent });
        expect(enclosingFnChainHasBinding(child)).toBe(false);
    });
});
