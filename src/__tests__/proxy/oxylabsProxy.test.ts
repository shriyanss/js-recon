import { describe, it, expect } from "vitest";
import { composeOxylabsUsername, buildOxylabsProxyUrl } from "../../proxy/oxylabsProxy.js";

describe("composeOxylabsUsername", () => {
    it("composes base username only", () => {
        expect(composeOxylabsUsername({ username: "testuser", password: "fakepassword123" })).toBe(
            "customer-testuser"
        );
    });

    it("appends country", () => {
        expect(
            composeOxylabsUsername({ username: "testuser", password: "fakepassword123", country: "US" })
        ).toBe("customer-testuser-cc-US");
    });

    it("appends country and city", () => {
        expect(
            composeOxylabsUsername({
                username: "testuser",
                password: "fakepassword123",
                country: "US",
                city: "newyork",
            })
        ).toBe("customer-testuser-cc-US-city-newyork");
    });

    it("appends session id only", () => {
        expect(
            composeOxylabsUsername({ username: "testuser", password: "fakepassword123", sessionId: "abc12345" })
        ).toBe("customer-testuser-sessid-abc12345");
    });

    it("combines country, city, and session id", () => {
        expect(
            composeOxylabsUsername({
                username: "testuser",
                password: "fakepassword123",
                country: "FR",
                city: "paris",
                sessionId: "sess001",
            })
        ).toBe("customer-testuser-cc-FR-city-paris-sessid-sess001");
    });

    it("throws when city is given without country", () => {
        expect(() =>
            composeOxylabsUsername({ username: "testuser", password: "fakepassword123", city: "paris" })
        ).toThrow();
    });
});

describe("buildOxylabsProxyUrl", () => {
    it("builds the full proxy URL against the fixed entry endpoint", () => {
        const url = buildOxylabsProxyUrl({ username: "testuser", password: "fakepassword123", country: "US" });
        expect(url).toBe("http://customer-testuser-cc-US:fakepassword123@pr.oxylabs.io:7777");
    });
});
