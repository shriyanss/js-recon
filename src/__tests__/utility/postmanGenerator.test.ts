import { describe, it, expect } from "vitest";
import {
    buildBodyExample,
    splitPath,
    generatePostmanCollection,
} from "../../utility/postmanGenerator.js";
import type { OpenapiOutputItem } from "../../utility/globals.js";

const makeItem = (overrides: Partial<OpenapiOutputItem>): OpenapiOutputItem => ({
    url: "https://example.com/api/test",
    path: "/api/test",
    method: "GET",
    chunkId: "chunk1",
    headers: {},
    body: null,
    ...overrides,
});

describe("buildBodyExample", () => {
    it("returns undefined for empty string", () => {
        expect(buildBodyExample("")).toBeUndefined();
    });

    it("pretty-prints valid JSON", () => {
        const result = buildBodyExample('{"key":"value"}');
        expect(result).toBe(JSON.stringify({ key: "value" }, null, 2));
    });

    it("returns raw string for invalid JSON", () => {
        const raw = "not json at all";
        expect(buildBodyExample(raw)).toBe(raw);
    });

    it("handles JSON with Zod-style placeholders", () => {
        const input = '{"name":"<string>","age":"<number>"}';
        const result = buildBodyExample(input);
        expect(result).toContain('"<string>"');
        expect(result).toContain('"<number>"');
    });
});

describe("splitPath", () => {
    it("splits simple path into segments", () => {
        const { segments, query } = splitPath("/api/v1/users");
        expect(segments).toEqual(["api", "v1", "users"]);
        expect(query).toHaveLength(0);
    });

    it("splits path with query string", () => {
        const { segments, query } = splitPath("/search?q=hello&limit=10");
        expect(segments).toEqual(["search"]);
        expect(query).toContainEqual({ key: "q", value: "hello" });
        expect(query).toContainEqual({ key: "limit", value: "10" });
    });

    it("filters out empty segments from leading slash", () => {
        const { segments } = splitPath("/api/data");
        expect(segments[0]).toBe("api");
    });

    it("handles path with no leading slash", () => {
        const { segments } = splitPath("api/v2/items");
        expect(segments).toEqual(["api", "v2", "items"]);
    });

    it("handles empty query values", () => {
        const { query } = splitPath("/search?foo=");
        expect(query).toContainEqual({ key: "foo", value: "" });
    });
});

describe("generatePostmanCollection", () => {
    it("returns a Postman v2.1 collection with info schema", () => {
        const collection = generatePostmanCollection([]);
        expect(collection.info.schema).toContain("v2.1");
    });

    it("returns empty item list for no endpoints", () => {
        const collection = generatePostmanCollection([]);
        expect(collection.item).toHaveLength(0);
    });

    it("creates a folder for the path prefix and places the request inside it", () => {
        const items = [makeItem({ path: "/api/users", method: "GET" })];
        const collection = generatePostmanCollection(items);
        // For /api/users: folderSegments=["api"], leaf="users"
        // The request is mounted directly in the "api" folder.
        const apiFolder = collection.item.find((i) => i.name === "api");
        expect(apiFolder).toBeDefined();
        // The "api" folder should contain a leaf item with a request (not another folder)
        const requestItem = apiFolder?.item?.find((i) => i.request !== undefined);
        expect(requestItem).toBeDefined();
    });

    it("places endpoint under a flat collectionFolder when specified", () => {
        const items = [
            { ...makeItem({ path: "/graphql", method: "POST" }), collectionFolder: "GraphQL" } as OpenapiOutputItem,
        ];
        const collection = generatePostmanCollection(items);
        const graphqlFolder = collection.item.find((i) => i.name === "GraphQL");
        expect(graphqlFolder).toBeDefined();
        expect(graphqlFolder?.item?.some((i) => i.request !== undefined)).toBe(true);
    });

    it("request method is uppercase in Postman collection", () => {
        const items = [makeItem({ path: "/api/create", method: "post" })];
        const collection = generatePostmanCollection(items);
        const find = (items: any[]): any => {
            for (const item of items) {
                if (item.request) return item;
                if (item.item) {
                    const found = find(item.item);
                    if (found) return found;
                }
            }
            return null;
        };
        const leaf = find(collection.item);
        expect(leaf?.request?.method).toBe("POST");
    });

    it("exposes baseUrl variable", () => {
        const collection = generatePostmanCollection([]);
        expect(collection.variable?.some((v) => v.key === "baseUrl")).toBe(true);
    });

    it("reuses existing folder for sibling endpoints", () => {
        const items = [
            makeItem({ path: "/api/users", method: "GET" }),
            makeItem({ path: "/api/posts", method: "GET" }),
        ];
        const collection = generatePostmanCollection(items);
        const apiFolder = collection.item.filter((i) => i.name === "api");
        expect(apiFolder).toHaveLength(1);
    });
});
