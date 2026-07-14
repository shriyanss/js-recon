import { describe, it, expect } from "vitest";
import { refactorNextWebpack } from "../../refactor/next/index.js";
import type { Chunk } from "../../utility/interfaces.js";

function makeChunk(id: string, code: string): Chunk {
    return {
        id,
        description: "none",
        loadedOn: [],
        containsFetch: false,
        isAxiosLibrary: false,
        exports: [],
        callStack: [],
        code,
        imports: [],
        file: "test.js",
    };
}

describe("refactorNextWebpack — named-function module wrapper", () => {
    it("recovers a module whose wrapper is a named function declaration (webpack 4/SWC form)", async () => {
        // Mirrors the synthesized shape from getWebpackConnections.ts:
        // `NNN: function (e, t, n) {...}` -> `function webpack_NNN (e, t, n) {...}`
        const code = `function webpack_61 (e, t, n) {
            Object.defineProperty(t, "__esModule", { value: !0 });
            Object.defineProperty(t, "getValue", { enumerable: !0, get: function () { return o; } });
            let r = n(5653);
            let o = 42;
        }`;
        const result = await refactorNextWebpack(makeChunk("61", code));
        expect(Object.keys(result)).toEqual(["61"]);
        expect(result["61"]).toContain("getValue");
        expect(result["61"]).not.toBe("");
    });

    it("does not fall through to a nested arrow function when the real wrapper is a named function", async () => {
        // The real module wrapper is the named function; an unrelated nested arrow
        // (e.g. an effect cleanup) sits deep inside its body. Before the fix, the
        // ArrowFunctionExpression visitor would wrongly accept this nested arrow as the
        // module wrapper because its immediate parent is an AssignmentExpression.
        const code = `function webpack_99 (e, t, n) {
            Object.defineProperty(t, "__esModule", { value: !0 });
            Object.defineProperty(t, "run", { enumerable: !0, get: function () { return run; } });
            function run() {
                let cleanup;
                cleanup = () => { doSomething(); };
                return cleanup;
            }
        }`;
        const result = await refactorNextWebpack(makeChunk("99", code));
        expect(Object.keys(result)).toEqual(["99"]);
        // The genuine wrapper's export (`run`) must survive — a false-positive capture
        // of the nested `cleanup = () => {...}` arrow would produce a 1-line garbage
        // fragment with no trace of the real module's exports.
        expect(result["99"]).toContain("run");
    });

    it("still recovers the arrow-form module wrapper (webpack 5)", async () => {
        const code = `func_42 = (e, t, n) => {
            Object.defineProperty(t, "__esModule", { value: !0 });
            Object.defineProperty(t, "getValue", { enumerable: !0, get: function () { return o; } });
            let o = 1;
        }`;
        const result = await refactorNextWebpack(makeChunk("42", code));
        expect(Object.keys(result)).toEqual(["42"]);
        expect(result["42"]).toContain("getValue");
    });

    it("returns empty when no top-level module wrapper exists at all", async () => {
        const code = `let x = 1; function helper() { return () => x; }`;
        const result = await refactorNextWebpack(makeChunk("7", code));
        expect(result).toEqual({});
    });
});
