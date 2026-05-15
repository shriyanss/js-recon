import { NodePath } from "@babel/traverse";
import _traverse from "@babel/traverse";
import parser from "@babel/parser";
import { Node } from "@babel/types";
import { Chunks } from "../../../utility/interfaces.js";
import { astNodeToJsonString } from "./astNodeToJsonString.js";

const traverse = _traverse.default;

// AST parse cache keyed by chunk id, so that cross-chunk tracing doesn't reparse
// the same chunk file dozens of times across recursive calls.
const astCache: Map<string, any> = new Map();
const parseChunkAst = (chunkId: string, code: string): any | null => {
    const cached = astCache.get(chunkId);
    if (cached !== undefined) return cached;
    try {
        const ast = parser.parse(code, {
            sourceType: "unambiguous",
            plugins: ["jsx", "typescript"],
            errorRecovery: true,
        });
        astCache.set(chunkId, ast);
        return ast;
    } catch {
        astCache.set(chunkId, null);
        return null;
    }
};

/**
 * Resolves an Identifier value by walking variable initializers in scope.
 *
 * Used when an object property is assigned an identifier like `{username: e, password: t}` —
 * we follow `e` to its declaration to find the real shape (e.g. another property of a state
 * value or a string literal).
 */
const resolvePropertyValueNode = (node: Node, scopePath: NodePath, depth: number = 0): string => {
    if (depth > 6) return `"[max depth]"`;
    if (!node) return `""`;

    if (node.type === "Identifier") {
        const binding = scopePath.scope.getBinding(node.name);
        if (binding && binding.path.isVariableDeclarator() && binding.path.node.init) {
            return resolvePropertyValueNode(binding.path.node.init, binding.path, depth + 1);
        }
        return `"[var ${node.name}]"`;
    }

    if (node.type === "ObjectExpression") {
        const props = node.properties
            .map((prop: any) => {
                if (prop.type === "ObjectProperty") {
                    let key = "";
                    if (prop.key.type === "Identifier") key = prop.key.name;
                    else if (prop.key.type === "StringLiteral") key = prop.key.value;
                    else key = "[unresolved key]";
                    const value = resolvePropertyValueNode(prop.value, scopePath, depth + 1);
                    return `"${key}": ${value}`;
                }
                if (prop.type === "SpreadElement") {
                    return `"...": ${resolvePropertyValueNode(prop.argument, scopePath, depth + 1)}`;
                }
                return null;
            })
            .filter(Boolean);
        return `{${props.join(", ")}}`;
    }

    if (node.type === "StringLiteral") return JSON.stringify(node.value);
    if (node.type === "NumericLiteral") return String(node.value);
    if (node.type === "BooleanLiteral") return String(node.value);
    if (node.type === "NullLiteral") return "null";

    return `"[${node.type}]"`;
};

/**
 * Builds a JSON-like body string from an ObjectExpression argument, resolving identifier
 * property values via Babel scope where possible.
 */
const objectExpressionToBody = (node: any, scopePath: NodePath): string => {
    const props = node.properties
        .map((prop: any) => {
            if (prop.type === "ObjectProperty") {
                let key = "";
                if (prop.key.type === "Identifier") key = prop.key.name;
                else if (prop.key.type === "StringLiteral") key = prop.key.value;
                else key = "[unresolved key]";
                const value = resolvePropertyValueNode(prop.value, scopePath, 0);
                return `"${key}": ${value}`;
            }
            if (prop.type === "SpreadElement") {
                return `"...": ${resolvePropertyValueNode(prop.argument, scopePath, 0)}`;
            }
            return null;
        })
        .filter(Boolean);
    return `{${props.join(", ")}}`;
};

/**
 * Discovers a zod-style schema in the chunk (e.g. `let w = x.z.object({...})`) and
 * converts it to a JSON-like body shape.
 *
 * Preference order:
 *   1. The schema referenced via an `objectSchema:` or `resolver:` JSX prop in the
 *      chunk (these point to the schema actually wired to the active form).
 *   2. The first standalone `z.object({...})` definition in the chunk.
 */
const findZodSchemaInChunk = (ast: Node): string | null => {
    let preferredSchemaVar: string | null = null;

    traverse(ast as any, {
        ObjectProperty(p) {
            if (preferredSchemaVar) return;
            const key = p.node.key as any;
            const keyName = key.type === "Identifier" ? key.name : key.type === "StringLiteral" ? key.value : null;
            if (keyName === "objectSchema") {
                if (p.node.value.type === "Identifier") {
                    preferredSchemaVar = p.node.value.name;
                }
            } else if (keyName === "resolver") {
                const v: any = p.node.value;
                if (v.type === "CallExpression" && v.arguments.length > 0 && v.arguments[0].type === "Identifier") {
                    preferredSchemaVar = v.arguments[0].name;
                }
            }
        },
    });

    const resolveSchemaVar = (varName: string, depth: number = 0): any => {
        if (depth > 6) return null;
        let initNode: any = null;
        traverse(ast as any, {
            VariableDeclarator(p) {
                if (initNode) return;
                if (p.node.id.type === "Identifier" && p.node.id.name === varName && p.node.init) {
                    initNode = p.node.init;
                    p.stop();
                }
            },
        });
        if (!initNode) return null;

        if (
            initNode.type === "CallExpression" &&
            initNode.callee.type === "MemberExpression" &&
            initNode.callee.property.type === "Identifier" &&
            initNode.callee.property.name === "object" &&
            initNode.arguments.length === 1 &&
            initNode.arguments[0].type === "ObjectExpression"
        ) {
            return initNode.arguments[0];
        }

        if (
            initNode.type === "CallExpression" &&
            initNode.callee.type === "MemberExpression" &&
            initNode.callee.property.type === "Identifier" &&
            (initNode.callee.property.name === "extend" || initNode.callee.property.name === "merge")
        ) {
            const baseObj = initNode.callee.object;
            if (baseObj.type === "Identifier") {
                return resolveSchemaVar(baseObj.name, depth + 1);
            }
        }

        if (initNode.type === "Identifier") {
            return resolveSchemaVar(initNode.name, depth + 1);
        }

        return null;
    };

    let schemaNode: any = null;

    if (preferredSchemaVar) {
        schemaNode = resolveSchemaVar(preferredSchemaVar);
    }

    if (!schemaNode) {
        traverse(ast as any, {
            CallExpression(p) {
                if (schemaNode) return;
                const callee = p.node.callee;
                if (
                    callee.type === "MemberExpression" &&
                    callee.property.type === "Identifier" &&
                    callee.property.name === "object" &&
                    p.node.arguments.length === 1 &&
                    p.node.arguments[0].type === "ObjectExpression"
                ) {
                    schemaNode = p.node.arguments[0];
                    p.stop();
                }
            },
        });
    }

    if (!schemaNode) return null;

    const zodTypeToPlaceholder = (valueNode: any): string => {
        let cur = valueNode;
        while (
            cur &&
            cur.type === "CallExpression" &&
            cur.callee.type === "MemberExpression" &&
            cur.callee.property.type === "Identifier" &&
            ["optional", "nullable", "nullish", "min", "max", "length", "email", "url", "uuid", "regex", "trim", "default", "describe", "refine", "transform"].includes(
                cur.callee.property.name,
            )
        ) {
            cur = cur.callee.object;
        }

        if (
            cur &&
            cur.type === "CallExpression" &&
            cur.callee.type === "MemberExpression" &&
            cur.callee.property.type === "Identifier"
        ) {
            const name = cur.callee.property.name;
            switch (name) {
                case "string":
                    return `"<string>"`;
                case "number":
                    return `"<number>"`;
                case "boolean":
                    return `"<boolean>"`;
                case "bigint":
                    return `"<bigint>"`;
                case "date":
                    return `"<date>"`;
                case "array":
                    return `["<array>"]`;
                case "object":
                    if (cur.arguments.length === 1 && cur.arguments[0].type === "ObjectExpression") {
                        return buildSchemaBody(cur.arguments[0]);
                    }
                    return `"<object>"`;
                case "enum":
                    return `"<enum>"`;
                case "literal":
                    if (cur.arguments.length === 1 && cur.arguments[0].type === "StringLiteral") {
                        return JSON.stringify(cur.arguments[0].value);
                    }
                    return `"<literal>"`;
                default:
                    return `"<${name}>"`;
            }
        }

        return `"<unknown>"`;
    };

    const buildSchemaBody = (objNode: any): string => {
        const parts = objNode.properties
            .map((prop: any) => {
                if (prop.type !== "ObjectProperty") return null;
                let key = "";
                if (prop.key.type === "Identifier") key = prop.key.name;
                else if (prop.key.type === "StringLiteral") key = prop.key.value;
                else return null;
                return `"${key}": ${zodTypeToPlaceholder(prop.value)}`;
            })
            .filter(Boolean);
        return `{${parts.join(", ")}}`;
    };

    return buildSchemaBody(schemaNode);
};

/**
 * Finds the webpack-export name a local function is exposed under.
 *
 * Webpack emits exports as:
 *   <thirdArg>.d(<exportObj>, { EXPNAME: function() { return funcName; } })
 *
 * Given `funcName`, returns the matching `EXPNAME` (or null if not exported).
 */
const findExportNameForFunc = (ast: Node, funcName: string): string | null => {
    let exportName: string | null = null;
    traverse(ast as any, {
        CallExpression(p) {
            if (exportName) return;
            const callee = p.node.callee;
            if (callee.type !== "MemberExpression") return;
            if (callee.property.type !== "Identifier" || callee.property.name !== "d") return;
            if (p.node.arguments.length !== 2) return;
            if (p.node.arguments[1].type !== "ObjectExpression") return;

            for (const prop of (p.node.arguments[1] as any).properties) {
                if (prop.type !== "ObjectProperty" || prop.key.type !== "Identifier") continue;
                const value = prop.value;
                if (value.type !== "FunctionExpression" && value.type !== "ArrowFunctionExpression") continue;

                let returnNode: any = null;
                if (value.type === "ArrowFunctionExpression" && value.body.type !== "BlockStatement") {
                    returnNode = value.body;
                } else if (value.body.type === "BlockStatement") {
                    const ret = value.body.body.find((s: any) => s.type === "ReturnStatement");
                    if (ret) returnNode = (ret as any).argument;
                }

                if (returnNode && returnNode.type === "Identifier" && returnNode.name === funcName) {
                    exportName = prop.key.name;
                    return;
                }
            }
        },
    });
    return exportName;
};

/**
 * Finds the third parameter (webpack-require) name of a module function in an AST.
 *
 * Webpack module wrappers look like `function (e, t, n) { ... }` or
 * `MODULE_ID: function (e, t, n) { ... }`. The third param is the require function
 * used to import other chunks: `var X = n(<chunkId>)`.
 */
const findThirdArgInAst = (ast: Node): string | null => {
    let thirdArg: string | null = null;
    traverse(ast as any, {
        Function(p) {
            if (thirdArg) return;
            const fn: any = p.node;
            if (fn.params && fn.params.length === 3 && fn.params[2].type === "Identifier") {
                thirdArg = fn.params[2].name;
                p.stop();
            }
        },
    });
    return thirdArg;
};

/**
 * Cross-chunk callsite trace.
 *
 * When a wrapper function (e.g. `let i = (t, e) => axios.post("/url", t, e)`) has
 * no local callsites — typical for "service module" chunks whose only purpose is
 * to export wrappers — search every chunk that imports the current chunk, look
 * for invocations of the corresponding export (`x.cr(args)` or `(0, x.cr)(args)`),
 * and recurse into the body argument's identifier in that scope.
 */
const crossChunkTrace = (
    funcName: string,
    paramIndex: number,
    currentChunkId: string,
    currentAst: Node,
    chunks: Chunks,
    visited: Set<string>,
    depth: number,
): string | null => {
    const exportName = findExportNameForFunc(currentAst, funcName);
    if (!exportName) return null;

    for (const [otherChunkId, otherChunk] of Object.entries(chunks)) {
        if (otherChunkId === currentChunkId) continue;
        if (!otherChunk.imports || !otherChunk.imports.includes(currentChunkId)) continue;

        const otherAst = parseChunkAst(otherChunkId, otherChunk.code);
        if (!otherAst) continue;

        const otherThirdArg = findThirdArgInAst(otherAst);
        if (!otherThirdArg) continue;

        // Find every variable that is `<otherThirdArg>(<currentChunkId>)`.
        const importVarNames: Set<string> = new Set();
        traverse(otherAst, {
            VariableDeclarator(p) {
                if (
                    p.node.id.type === "Identifier" &&
                    p.node.init &&
                    p.node.init.type === "CallExpression" &&
                    p.node.init.callee.type === "Identifier" &&
                    p.node.init.callee.name === otherThirdArg &&
                    p.node.init.arguments.length === 1 &&
                    p.node.init.arguments[0].type === "NumericLiteral" &&
                    String((p.node.init.arguments[0] as any).value) === currentChunkId
                ) {
                    importVarNames.add(p.node.id.name);
                }
            },
        });

        if (importVarNames.size === 0) continue;

        let resolved: string | null = null;

        traverse(otherAst, {
            CallExpression(callPath) {
                if (resolved) return;

                // Unwrap (0, X.exp)(...) → callee is SequenceExpression whose last element
                // is the member expression we care about.
                let callee: any = callPath.node.callee;
                if (callee.type === "SequenceExpression") {
                    callee = callee.expressions[callee.expressions.length - 1];
                }

                if (
                    callee.type !== "MemberExpression" ||
                    callee.object.type !== "Identifier" ||
                    !importVarNames.has(callee.object.name) ||
                    callee.property.type !== "Identifier" ||
                    callee.property.name !== exportName
                ) {
                    return;
                }

                const argNode = callPath.node.arguments[paramIndex];
                if (!argNode) return;

                if (argNode.type === "ObjectExpression") {
                    resolved = objectExpressionToBody(argNode, callPath);
                    callPath.stop();
                    return;
                }

                if (argNode.type === "Identifier") {
                    const traced = traceIdentifierBody(
                        argNode.name,
                        callPath,
                        otherAst,
                        otherChunk.code,
                        chunks,
                        visited,
                        depth + 1,
                        otherChunkId,
                    );
                    if (traced) {
                        resolved = traced;
                        callPath.stop();
                    }
                }
            },
        });

        if (resolved) return resolved;
    }

    return null;
};

/**
 * Traces a function-parameter identifier back through call sites to find its
 * actual body shape.
 *
 * Algorithm:
 *   1. Look up the binding for `paramName` in `path.scope`.
 *   2. If the binding is a function parameter, walk to the enclosing function,
 *      determine the parameter index, and find the function's bound name (if any).
 *   3. Search the current chunk's AST for direct call sites of that function. For
 *      each call site, inspect the argument at the same index:
 *        - If it's an ObjectExpression, convert it to a JSON-like body and return.
 *        - If it's an Identifier, recurse on it.
 *   4. If no local call site resolves the shape:
 *      a. Try cross-chunk tracing: find the chunk's export name for this function
 *         and recurse into every chunk that imports the export.
 *      b. As a last resort, fall back to discovering a zod schema in the same chunk.
 */
export const traceIdentifierBody = (
    paramName: string,
    path: NodePath,
    ast: Node,
    chunkCode: string,
    chunks: Chunks | undefined,
    visited: Set<string> = new Set(),
    depth: number = 0,
    chunkId?: string,
): string | null => {
    if (depth > 6) return null;

    const binding = path.scope.getBinding(paramName);
    if (!binding) return null;
    if (binding.kind !== "param") return null;

    const funcPath = binding.path.find((p) => p.isFunction()) as NodePath | null;
    if (!funcPath) return null;

    const funcNode: any = funcPath.node;
    const paramIndex = funcNode.params.findIndex(
        (p: any) => p.type === "Identifier" && p.name === paramName,
    );
    if (paramIndex === -1) return null;

    let funcName: string | null = null;
    if (funcPath.isFunctionDeclaration() && funcNode.id?.type === "Identifier") {
        funcName = funcNode.id.name;
    } else if (funcPath.parentPath) {
        const parent: any = funcPath.parentPath.node;
        if (parent.type === "VariableDeclarator" && parent.id?.type === "Identifier") {
            funcName = parent.id.name;
        } else if (parent.type === "AssignmentExpression" && parent.left?.type === "Identifier") {
            funcName = parent.left.name;
        }
    }

    if (!funcName) {
        return findZodSchemaInChunk(ast);
    }

    const cycleKey = `${chunkId ?? "_"}:${funcName}:${paramIndex}`;
    if (visited.has(cycleKey)) return null;
    visited.add(cycleKey);

    const targetFuncNode: Node = funcNode;

    let resolved: string | null = null;
    let directCallCount = 0;

    traverse(ast as any, {
        CallExpression(callPath) {
            if (resolved) return;
            const callee = callPath.node.callee;
            if (callee.type === "Identifier" && callee.name === funcName) {
                const callBinding = callPath.scope.getBinding(funcName);
                if (!callBinding) return;
                const callTargetFunc =
                    callBinding.path.isVariableDeclarator() && (callBinding.path.node as any).init
                        ? (callBinding.path.node as any).init
                        : callBinding.path.node;
                if (callTargetFunc !== targetFuncNode) {
                    return;
                }
                directCallCount++;
                const argNode = callPath.node.arguments[paramIndex];
                if (!argNode) return;

                if (argNode.type === "ObjectExpression") {
                    resolved = objectExpressionToBody(argNode, callPath);
                    callPath.stop();
                    return;
                }

                if (argNode.type === "Identifier") {
                    const traced = traceIdentifierBody(
                        argNode.name,
                        callPath,
                        ast,
                        chunkCode,
                        chunks,
                        visited,
                        depth + 1,
                        chunkId,
                    );
                    if (traced) {
                        resolved = traced;
                        callPath.stop();
                    }
                }
            }
        },
    });

    if (resolved) return resolved;

    // No local resolution. Try cross-chunk callsite trace before falling back to
    // schema discovery — cross-chunk usually carries real call-site evidence,
    // while zod schemas in unrelated chunks are easy to misidentify.
    if (chunkId && chunks) {
        const crossChunk = crossChunkTrace(funcName, paramIndex, chunkId, ast, chunks, visited, depth);
        if (crossChunk) return crossChunk;
    }

    if (directCallCount === 0) {
        return findZodSchemaInChunk(ast);
    }

    return null;
};

/**
 * Convenience entry that converts the result back into something acceptable as a
 * `callBody` string. Returns null if no improvement is possible.
 */
export const maybeTraceBodyForIdentifier = (
    bodyArgNode: Node,
    parentCallPath: NodePath,
    ast: Node,
    chunkCode: string,
    chunks: Chunks | undefined,
    chunkId?: string,
): string | null => {
    if (!bodyArgNode || bodyArgNode.type !== "Identifier") return null;
    const idName = (bodyArgNode as any).name as string;
    return traceIdentifierBody(idName, parentCallPath, ast, chunkCode, chunks, new Set(), 0, chunkId);
};

/**
 * Helper: rebuild the original astNodeToJsonString result, but for an Identifier-only
 * body, attempt to improve via taint trace.
 */
export const resolveBodyArg = (
    bodyArgNode: Node,
    parentCallPath: NodePath,
    ast: Node,
    chunkCode: string,
    chunks: Chunks | undefined,
    chunkId?: string,
): string => {
    if (bodyArgNode && bodyArgNode.type === "Identifier") {
        const traced = maybeTraceBodyForIdentifier(bodyArgNode, parentCallPath, ast, chunkCode, chunks, chunkId);
        if (traced) return traced;
    }
    return astNodeToJsonString(bodyArgNode, chunkCode);
};
