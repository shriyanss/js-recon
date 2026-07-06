import { describe, it, expect } from "vitest";
import * as t from "@babel/types";
import { tryStrictParse, validateAndFix } from "../../refactor/react/validator.js";

describe("tryStrictParse", () => {
    it("returns an empty array for syntactically valid ES module code", () => {
        expect(tryStrictParse("export const x = 1;")).toHaveLength(0);
    });

    it("returns an empty array for a valid export default", () => {
        expect(tryStrictParse("export default function foo() {}")).toHaveLength(0);
    });

    it("returns a non-empty array for invalid syntax", () => {
        expect(tryStrictParse("===not valid===")).not.toHaveLength(0);
    });

    it("returns an empty array for valid JSX (jsx plugin is active)", () => {
        expect(tryStrictParse("export const el = <div />;")).toHaveLength(0);
    });
});

describe("validateAndFix", () => {
    it("returns generated code for a set of valid statements", () => {
        const stmts: t.Statement[] = [
            t.variableDeclaration("const", [
                t.variableDeclarator(t.identifier("x"), t.numericLiteral(42)),
            ]),
        ];
        const result = validateAndFix(stmts, "test-module");
        expect(result).not.toBeNull();
        expect(result).toContain("const x = 42");
    });

    it("returns code for an export default declaration", () => {
        const stmts: t.Statement[] = [
            t.exportDefaultDeclaration(t.numericLiteral(1)),
        ];
        const result = validateAndFix(stmts, "test-module");
        expect(result).not.toBeNull();
        expect(result).toContain("export default");
    });

    it("returns code for an export named declaration", () => {
        const stmts: t.Statement[] = [
            t.exportNamedDeclaration(
                t.variableDeclaration("const", [
                    t.variableDeclarator(t.identifier("y"), t.stringLiteral("hello")),
                ]),
            ),
        ];
        const result = validateAndFix(stmts, "test-module");
        expect(result).not.toBeNull();
        expect(result).toContain("export const y");
    });
});
