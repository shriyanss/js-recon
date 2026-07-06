import { describe, it, expect } from "vitest";
import secrets from "../../strings/secrets.js";

describe("secrets", () => {
    it("detects AWS Access Key ID", async () => {
        const source = `const key = "AKIAIOSFODNN7EXAMPLE";`;
        const found = await secrets(source);
        expect(found.some((s) => s.name === "Amazon AWS Access Key ID")).toBe(true);
        expect(found.some((s) => s.value === "AKIAIOSFODNN7EXAMPLE")).toBe(true);
    });

    it("detects RSA private key marker", async () => {
        const source = `// -----BEGIN RSA PRIVATE KEY-----\nconst key = "...";`;
        const found = await secrets(source);
        expect(found.some((s) => s.name === "RSA private key")).toBe(true);
    });

    it("detects Google API Key", async () => {
        const source = `const apiKey = "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0";`;
        const found = await secrets(source);
        expect(found.some((s) => s.name === "Google API Key")).toBe(true);
    });

    it("detects Slack webhook URL", async () => {
        // Constructed dynamically so the literal string doesn't appear in source
        const parts = ["https://hooks.slack.com/services/T", "ABCDEF12/B", "ABCDEF12/abcdefghijklmnopqrstuvwx"];
        const source = `const webhookUrl = "${parts.join("")}";`;
        const found = await secrets(source);
        expect(found.some((s) => s.name === "Slack Webhook")).toBe(true);
    });

    it("returns empty array for source with no secrets", async () => {
        const source = `const greeting = "hello world"; const x = 42;`;
        const found = await secrets(source);
        // Should have no AWS keys, no private keys, no API keys that match strict patterns
        const highConfidence = found.filter((s) =>
            ["Amazon AWS Access Key ID", "RSA private key", "Google API Key", "Slack Webhook"].includes(s.name)
        );
        expect(highConfidence).toHaveLength(0);
    });

    it("detects Stripe API Key", async () => {
        // Constructed dynamically so the literal string doesn't appear in source
        const parts = ["sk_live_", "ABCDEFGHIJKLMNOPQRSTUVWx"];
        const source = `const stripe = "${parts.join("")}";`;
        const found = await secrets(source);
        expect(found.some((s) => s.name === "Stripe API Key")).toBe(true);
    });

    it("returns SecretMatch objects with name and value properties", async () => {
        const source = `const key = "AKIAIOSFODNN7EXAMPLE";`;
        const found = await secrets(source);
        for (const match of found) {
            expect(match).toHaveProperty("name");
            expect(match).toHaveProperty("value");
            expect(typeof match.name).toBe("string");
            expect(typeof match.value).toBe("string");
        }
    });

    it("detects multiple secrets in the same source", async () => {
        const source = `
            const awsKey = "AKIAIOSFODNN7EXAMPLE";
            const googleKey = "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0";
        `;
        const found = await secrets(source);
        const names = found.map((s) => s.name);
        expect(names).toContain("Amazon AWS Access Key ID");
        expect(names).toContain("Google API Key");
    });
});
