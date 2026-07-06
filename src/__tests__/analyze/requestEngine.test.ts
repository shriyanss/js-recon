import { describe, it, expect } from "vitest";
import engine from "../../analyze/engine/requestEngine.js";
import type { Rule } from "../../analyze/types/index.js";
import type { OpenAPISpec } from "../../utility/openapiGenerator.js";

const makeSpec = (paths: Record<string, any>): OpenAPISpec => ({
    openapi: "3.0.0",
    info: { title: "Test", description: "", version: "1.0.0" },
    servers: [{ url: "{{baseUrl}}", description: "" }],
    paths,
});

const makeRule = (overrides: Partial<Rule> = {}): Rule =>
    ({
        id: "test-rule",
        name: "Test Rule",
        author: "tester",
        description: "test",
        js_recon_version: ">=1.0.0",
        tech: ["next"],
        severity: "info",
        type: "request",
        steps: [],
        ...overrides,
    }) as Rule;

describe("requestEngine", () => {
    it("finds endpoint when URL contains the pattern", async () => {
        const spec = makeSpec({
            "/api/admin/users": { get: { summary: "List users", responses: { 200: { description: "ok" } } } },
        });
        const rule = makeRule({
            steps: [
                { name: "s1", message: "Found admin", request: { type: "url", condition: "contains", name: "admin" } },
            ],
        });
        const findings = await engine(rule, spec);
        expect(findings).toHaveLength(1);
        expect(findings[0].findingLocation).toContain("/api/admin/users");
    });

    it("finds nothing when URL does not contain the pattern", async () => {
        const spec = makeSpec({
            "/api/public/data": { get: { summary: "Public", responses: { 200: { description: "ok" } } } },
        });
        const rule = makeRule({
            steps: [
                { name: "s1", message: "Found admin", request: { type: "url", condition: "contains", name: "admin" } },
            ],
        });
        const findings = await engine(rule, spec);
        expect(findings).toHaveLength(0);
    });

    it("URL absent condition passes when pattern is not in path", async () => {
        const spec = makeSpec({
            "/api/public/data": { get: { summary: "Public", responses: { 200: { description: "ok" } } } },
        });
        const rule = makeRule({
            steps: [{ name: "s1", message: "No auth", request: { type: "url", condition: "absent", name: "auth" } }],
        });
        const findings = await engine(rule, spec);
        expect(findings).toHaveLength(1);
    });

    it("URL absent condition fails when pattern is present", async () => {
        const spec = makeSpec({
            "/api/auth/login": { post: { summary: "Login", responses: { 200: { description: "ok" } } } },
        });
        const rule = makeRule({
            steps: [{ name: "s1", message: "Has auth", request: { type: "url", condition: "absent", name: "auth" } }],
        });
        const findings = await engine(rule, spec);
        expect(findings).toHaveLength(0);
    });

    it("header contains condition passes when header exists", async () => {
        const spec = makeSpec({
            "/api/action": {
                post: {
                    summary: "Action",
                    responses: { 200: { description: "ok" } },
                    parameters: [{ name: "next-action", in: "header", schema: { type: "string" } }],
                },
            },
        });
        const rule = makeRule({
            steps: [
                {
                    name: "s1",
                    message: "Has next-action",
                    request: { type: "headers", condition: "contains", name: "next-action" },
                },
            ],
        });
        const findings = await engine(rule, spec);
        expect(findings).toHaveLength(1);
    });

    it("header absent condition passes when header is not present", async () => {
        const spec = makeSpec({
            "/api/data": { get: { summary: "Data", responses: { 200: { description: "ok" } } } },
        });
        const rule = makeRule({
            steps: [
                {
                    name: "s1",
                    message: "No auth header",
                    request: { type: "headers", condition: "absent", name: "Authorization" },
                },
            ],
        });
        const findings = await engine(rule, spec);
        expect(findings).toHaveLength(1);
    });

    it("header absent condition fails when header is present", async () => {
        const spec = makeSpec({
            "/api/secure": {
                get: {
                    summary: "Secure",
                    responses: { 200: { description: "ok" } },
                    parameters: [{ name: "Authorization", in: "header", schema: { type: "string" } }],
                },
            },
        });
        const rule = makeRule({
            steps: [
                {
                    name: "s1",
                    message: "No auth header",
                    request: { type: "headers", condition: "absent", name: "Authorization" },
                },
            ],
        });
        const findings = await engine(rule, spec);
        expect(findings).toHaveLength(0);
    });

    it("method is condition passes when method matches", async () => {
        const spec = makeSpec({
            "/api/create": { post: { summary: "Create", responses: { 200: { description: "ok" } } } },
        });
        const rule = makeRule({
            steps: [{ name: "s1", message: "Is POST", request: { type: "method", condition: "is", name: "POST" } }],
        });
        const findings = await engine(rule, spec);
        expect(findings).toHaveLength(1);
    });

    it("method is condition is case-insensitive", async () => {
        const spec = makeSpec({
            "/api/create": { POST: { summary: "Create", responses: { 200: { description: "ok" } } } },
        });
        const rule = makeRule({
            steps: [{ name: "s1", message: "Is POST", request: { type: "method", condition: "is", name: "post" } }],
        });
        const findings = await engine(rule, spec);
        expect(findings).toHaveLength(1);
    });

    it("method is_not condition passes when method differs", async () => {
        const spec = makeSpec({
            "/api/data": { get: { summary: "Get data", responses: { 200: { description: "ok" } } } },
        });
        const rule = makeRule({
            steps: [
                { name: "s1", message: "Not POST", request: { type: "method", condition: "is_not", name: "post" } },
            ],
        });
        const findings = await engine(rule, spec);
        expect(findings).toHaveLength(1);
    });

    it("multi-step rule requires ALL steps to pass", async () => {
        const spec = makeSpec({
            "/api/admin/action": {
                post: {
                    summary: "Admin action",
                    responses: { 200: { description: "ok" } },
                    parameters: [{ name: "next-action", in: "header", schema: { type: "string" } }],
                },
            },
        });
        const rule = makeRule({
            steps: [
                { name: "s1", message: "Has admin", request: { type: "url", condition: "contains", name: "admin" } },
                {
                    name: "s2",
                    message: "Has next-action",
                    request: { type: "headers", condition: "contains", name: "next-action" },
                },
                { name: "s3", message: "Is POST", request: { type: "method", condition: "is", name: "post" } },
            ],
        });
        const findings = await engine(rule, spec);
        expect(findings).toHaveLength(1);
    });

    it("multi-step rule fails when one step does not pass", async () => {
        const spec = makeSpec({
            "/api/admin/action": { post: { summary: "Admin action", responses: { 200: { description: "ok" } } } },
        });
        const rule = makeRule({
            steps: [
                { name: "s1", message: "Has admin", request: { type: "url", condition: "contains", name: "admin" } },
                {
                    name: "s2",
                    message: "Has next-action",
                    request: { type: "headers", condition: "contains", name: "next-action" },
                },
            ],
        });
        const findings = await engine(rule, spec);
        expect(findings).toHaveLength(0);
    });

    it("returns findings for multiple matching paths", async () => {
        const spec = makeSpec({
            "/api/admin/users": { get: { summary: "Users", responses: { 200: { description: "ok" } } } },
            "/api/admin/posts": { get: { summary: "Posts", responses: { 200: { description: "ok" } } } },
            "/api/public/data": { get: { summary: "Public", responses: { 200: { description: "ok" } } } },
        });
        const rule = makeRule({
            steps: [{ name: "s1", message: "Admin", request: { type: "url", condition: "contains", name: "admin" } }],
        });
        const findings = await engine(rule, spec);
        expect(findings).toHaveLength(2);
    });

    it("returns empty array for empty spec", async () => {
        const spec = makeSpec({});
        const rule = makeRule({
            steps: [{ name: "s1", message: "x", request: { type: "url", condition: "contains", name: "/api/" } }],
        });
        const findings = await engine(rule, spec);
        expect(findings).toHaveLength(0);
    });

    it("finding includes ruleName, ruleId, severity, and findingLocation", async () => {
        const spec = makeSpec({
            "/api/admin": { delete: { summary: "Delete", responses: { 200: { description: "ok" } } } },
        });
        const rule = makeRule({
            id: "my-rule-id",
            name: "My Rule Name",
            severity: "high",
            steps: [{ name: "s1", message: "Found", request: { type: "url", condition: "contains", name: "admin" } }],
        });
        const findings = await engine(rule, spec);
        expect(findings[0].ruleId).toBe("my-rule-id");
        expect(findings[0].ruleName).toBe("My Rule Name");
        expect(findings[0].severity).toBe("high");
        expect(findings[0].findingLocation).toContain("/api/admin");
    });
});
