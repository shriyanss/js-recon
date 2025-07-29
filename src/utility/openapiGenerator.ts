import { OpenapiOutputItem } from "./globals.js";
import { Chunks } from "./interfaces.js";
import * as globalsUtil from "./globals.js";
import replacePlaceholders from "./replaceUrlPlaceholders.js";

export interface OpenAPISpec {
    openapi: string;
    info: {
        title: string;
        description: string;
        version: string;
    };
    servers: Array<{
        url: string;
        description: string;
    }>;
    paths: {
        [key: string]: any;
    };
}

/**
 * Generates a minimal OpenAPI v3 specification document from the collected
 * `OpenapiOutputItem` objects.
 *
 * The generated document includes:
 *  - Basic `info` section
 *  - A single `servers` entry with a `{{baseUrl}}` placeholder
 *  - An entry in `paths` for every unique combination of `path` & HTTP `method`
 *    discovered, including request headers & body where available.
 */
export const getOpenApiType = (value: any): string => {
    if (value === null) {
        return "string"; // OpenAPI 3.0 doesn't have a 'null' type, use nullable
    }
    if (Array.isArray(value)) {
        return "array";
    }
    const jsType = typeof value;
    if (["string", "number", "boolean", "object"].includes(jsType)) {
        return jsType;
    }
    return "string"; // Fallback for other types
};

export const generateOpenapiV3Spec = (items: OpenapiOutputItem[], chunks: Chunks): OpenAPISpec => {
    const spec: OpenAPISpec = {
        openapi: "3.0.0",
        info: {
            title: "API Collection",
            description: "A collection of API endpoints discovered by js-recon.",
            version: "1.0.0",
        },
        servers: [
            {
                url: "{{baseUrl}}",
                description: "Base URL for the API",
            },
        ],
        paths: {},
    };

    for (const item of items) {
        const pathKeyBeforeQuery = item.path.split("?")[0];
        const pathKey = replacePlaceholders(
            pathKeyBeforeQuery.startsWith("/") ? pathKeyBeforeQuery : `/${pathKeyBeforeQuery}`
        );
        const method = item.method.toLowerCase();

        if (!spec.paths[pathKey]) {
            spec.paths[pathKey] = {};
        }

        // Avoid overwriting if the same path & method already processed
        if (spec.paths[pathKey][method]) {
            continue;
        }

        const parameters = Object.entries(item.headers || {}).map(([name, value]) => {
            const schema: any = {
                type: getOpenApiType(value),
                example: value,
            };
            if (value === null) {
                schema.nullable = true;
            }
            return {
                name,
                in: "header",
                required: true, // Assuming headers found are required for the call to succeed as intended
                schema,
            };
        });

        // Extract path parameters
        const pathParams = pathKey.match(/\{([^}]+)\}/g);
        if (pathParams) {
            for (const p of pathParams) {
                const paramName = p.slice(1, -1);
                parameters.push({
                    name: paramName,
                    in: "path",
                    required: true,
                    schema: { type: "string", example: "any" },
                });
            }
        }

        // Extract query parameters
        const url = new URL(item.path, "http://dummybase");
        const queryParams = url.searchParams;

        queryParams.forEach((value, name) => {
            parameters.push({
                name: name,
                in: "query",
                required: false, // Or determine based on logic
                schema: { type: "string", example: value },
            });
        });

        const operationObject: any = {
            summary: `${pathKey}`,
            responses: {
                200: {
                    description: "Successful response. The actual response will vary.",
                },
            },
            tags: globalsUtil.getOpenapiChunkTag() ? [item.chunkId] : [],
        };

        if (parameters.length > 0) {
            operationObject.parameters = parameters;
        }

        if (item.body) {
            let requestBody;
            try {
                const body = JSON.parse(item.body);
                if (typeof body === "object" && body !== null) {
                    const properties = {};
                    for (const key in body) {
                        const value = body[key];
                        const type = getOpenApiType(value);
                        properties[key] = {
                            type: type,
                            example: value,
                        };
                        if (value === null) {
                            properties[key].nullable = true;
                        }
                    }
                    requestBody = {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: properties,
                                },
                            },
                        },
                    };
                } else {
                    throw new Error("Body is not a JSON object.");
                }
            } catch (error) {
                // Fallback for non-JSON bodies
                requestBody = {
                    content: {
                        "application/json": {
                            schema: { type: "string" },
                            example: item.body,
                        },
                    },
                };
            }
            operationObject.requestBody = requestBody;
        }

        spec.paths[pathKey][method] = operationObject;
    }

    return spec;
};
