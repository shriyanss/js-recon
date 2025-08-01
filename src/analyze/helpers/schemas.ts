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
    z.object({
        type: z.literal("method"),
        condition: z.enum(["is", "is_not"]),
        name: z.string(),
    }),
]);

const esqueryStepSchema = z.object({
    type: z.literal("esquery"),
    query: z.string(),
});

const PostMessageFuncResolverStepSchema = z.object({
    name: z.string(),
});

const checkAssignmentExistStepSchema = z.object({
    name: z.string(),
    type: z.string(),
    memberExpression: z.boolean().optional(),
});

const stepSchema = z.object({
    name: z.string(),
    message: z.string(),
    requires: z.array(z.string()).optional(),
    request: requestStepSchema.optional(),
    esquery: esqueryStepSchema.optional(),
    postMessageFuncResolve: PostMessageFuncResolverStepSchema.optional(),
    checkAssignmentExist: checkAssignmentExistStepSchema.optional(),
});

export const ruleSchema = z.object({
    id: z.string(),
    name: z.string(),
    author: z.string(),
    description: z.string(),
    tech: z.array(z.literal("next")),
    severity: z.enum(["info", "low", "medium", "high"]),
    type: z.enum(["request", "ast"]),
    steps: z.array(stepSchema),
});
