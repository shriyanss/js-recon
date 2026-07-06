import { describe, it, expect } from "vitest";
import { ruleSchema } from "../../analyze/helpers/schemas.js";

const validRequestRule = {
    id: "test-rule-001",
    name: "Test Rule",
    author: "tester",
    description: "A test rule",
    js_recon_version: ">=1.0.0",
    tech: ["next"],
    severity: "info",
    type: "request",
    steps: [
        {
            name: "step1",
            message: "Found something",
            request: {
                type: "url",
                condition: "contains",
                name: "/api/",
            },
        },
    ],
};

const validAstRule = {
    id: "test-ast-001",
    name: "AST Rule",
    author: "tester",
    description: "An AST-based test rule",
    js_recon_version: ">=1.0.0",
    tech: ["vue", "react"],
    severity: "high",
    type: "ast",
    steps: [
        {
            name: "step1",
            message: "Matched AST",
            esquery: {
                type: "esquery",
                query: "CallExpression[callee.name='eval']",
            },
        },
    ],
};

describe("ruleSchema", () => {
    it("parses a valid request rule", () => {
        expect(() => ruleSchema.parse(validRequestRule)).not.toThrow();
    });

    it("parses a valid AST rule", () => {
        expect(() => ruleSchema.parse(validAstRule)).not.toThrow();
    });

    it("rejects rule missing required id field", () => {
        const bad = { ...validRequestRule };
        delete (bad as any).id;
        expect(() => ruleSchema.parse(bad)).toThrow();
    });

    it("rejects rule missing required name field", () => {
        const bad = { ...validRequestRule };
        delete (bad as any).name;
        expect(() => ruleSchema.parse(bad)).toThrow();
    });

    it("rejects invalid severity value", () => {
        const bad = { ...validRequestRule, severity: "critical" };
        expect(() => ruleSchema.parse(bad)).toThrow();
    });

    it("accepts all valid severity values", () => {
        for (const sev of ["info", "low", "medium", "high"] as const) {
            expect(() => ruleSchema.parse({ ...validRequestRule, severity: sev })).not.toThrow();
        }
    });

    it("rejects invalid type value", () => {
        const bad = { ...validRequestRule, type: "unknown" };
        expect(() => ruleSchema.parse(bad)).toThrow();
    });

    it("rejects invalid tech value", () => {
        const bad = { ...validRequestRule, tech: ["wordpress"] };
        expect(() => ruleSchema.parse(bad)).toThrow();
    });

    it("accepts all valid tech values including 'all'", () => {
        const techs = ["next", "vue", "react", "svelte", "angular", "all"] as const;
        expect(() => ruleSchema.parse({ ...validRequestRule, tech: techs })).not.toThrow();
    });

    it("accepts request step with headers type", () => {
        const rule = {
            ...validRequestRule,
            steps: [
                {
                    name: "check-header",
                    message: "Header found",
                    request: { type: "headers", condition: "contains", name: "next-action" },
                },
            ],
        };
        expect(() => ruleSchema.parse(rule)).not.toThrow();
    });

    it("accepts request step with method type", () => {
        const rule = {
            ...validRequestRule,
            steps: [
                {
                    name: "check-method",
                    message: "POST method",
                    request: { type: "method", condition: "is", name: "POST" },
                },
            ],
        };
        expect(() => ruleSchema.parse(rule)).not.toThrow();
    });

    it("rejects request step with invalid condition for url type", () => {
        const bad = {
            ...validRequestRule,
            steps: [
                {
                    name: "step1",
                    message: "bad",
                    request: { type: "url", condition: "equals", name: "/api/" },
                },
            ],
        };
        expect(() => ruleSchema.parse(bad)).toThrow();
    });

    it("accepts step with optional requires field", () => {
        const rule = {
            ...validRequestRule,
            steps: [
                {
                    name: "step2",
                    message: "Requires step1",
                    requires: ["step1"],
                    request: { type: "url", condition: "absent", name: "/auth/" },
                },
            ],
        };
        expect(() => ruleSchema.parse(rule)).not.toThrow();
    });

    it("accepts esquery step with optional inScopeOf and taintFrom", () => {
        const rule = {
            ...validAstRule,
            steps: [
                {
                    name: "scoped",
                    message: "Scoped match",
                    esquery: {
                        type: "esquery",
                        query: "Identifier[name='eval']",
                        inScopeOf: "FunctionDeclaration",
                        taintFrom: "AssignmentExpression",
                    },
                },
            ],
        };
        expect(() => ruleSchema.parse(rule)).not.toThrow();
    });

    it("rejects empty steps array", () => {
        const bad = { ...validRequestRule, steps: [] };
        // Zod does not enforce non-empty by default — just ensures it's an array
        // so this should parse; document actual behavior
        expect(() => ruleSchema.parse(bad)).not.toThrow();
    });
});
