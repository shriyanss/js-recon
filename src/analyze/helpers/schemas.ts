import { z } from "zod";

const requestStepSchema = z.union([
    z.object({
        type: z.literal("headers"),
        condition: z.enum(["contains", "absent"]),
        name: z.string(),
    }),
    z.object({
        type: z.literal("url"),
        condition: z.enum(["contains", "absent"]),
        name: z.string(),
    }),
]);

const stepSchema = z.object({
    name: z.string(),
    message: z.string(),
    requires: z.array(z.string()).optional(),
    request: requestStepSchema,
});

export const ruleSchema = z.object({
    id: z.string(),
    name: z.string(),
    author: z.string(),
    description: z.string(),
    tech: z.literal("next"),
    severity: z.enum(["info", "low", "medium", "high"]),
    type: z.literal("request"),
    steps: z.array(stepSchema),
});
