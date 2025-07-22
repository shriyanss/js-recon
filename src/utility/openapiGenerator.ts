import { OpenapiOutputItem } from "./globals.js";

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
export const generateOpenapiV3Spec = (
    items: OpenapiOutputItem[]
): OpenAPISpec => {
    const spec: OpenAPISpec = {
        openapi: "3.0.0",
        info: {
            title: "API Collection",
            description:
                "A collection of API endpoints discovered by js-recon.",
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
        const pathKey = item.path.startsWith("/") ? item.path : `/${item.path}`;
        const method = item.method.toLowerCase();

        if (!spec.paths[pathKey]) {
            spec.paths[pathKey] = {};
        }

        // Avoid overwriting if the same path & method already processed
        if (spec.paths[pathKey][method]) {
            continue;
        }

        const parameters = Object.entries(item.headers || {}).map(
            ([name, value]) => ({
                name,
                in: "header",
                required: true,
                schema: { type: "string", example: value },
            })
        );

        const operationObject: any = {
            summary: `${item.method.toUpperCase()} ${pathKey}`,
            responses: {
                200: {
                    description:
                        "Successful response. The actual response will vary.",
                },
            },
        };

        if (parameters.length > 0) {
            operationObject.parameters = parameters;
        }

        if (item.body) {
            operationObject.requestBody = {
                description: "Request body",
                content: {
                    "application/json": {
                        schema: { type: "string" },
                        example: item.body,
                    },
                },
            };
        }

        spec.paths[pathKey][method] = operationObject;
    }

    return spec;
};
