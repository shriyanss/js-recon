import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import fs from "fs";
import { resolveNodeValue, memberChainToString } from "../next_js/utils.js";

const traverse = _traverse.default;

export interface EnclosingFn {
    bindingName: string | null;
    firstParamName: string | null;
    node: any;
    file: string;
}

export interface CallerInfo {
    file: string;
    fileContent: string;
    callNode: any;
    scope: any;
    args: any[];
    enclosingFn: EnclosingFn | null;
}

/**
 * Pulls out the function binding name from the surrounding declarator /
 * assignment so we can later match callsites by identifier. Handles four
 * common shapes seen in Vite-bundled code:
 *   const fn = (arg) => { ... }
 *   fn = (arg) => { ... }
 *   function fn(arg) { ... }
 *   { fn: (arg) => { ... } }  // object-literal property value
 */
export const inferEnclosingFn = (callPath: any, file: string): EnclosingFn | null => {
    const fnPath = callPath.getFunctionParent();
    if (!fnPath) return null;
    const fnNode = fnPath.node;
    const firstParamName =
        fnNode.params && fnNode.params[0]?.type === "Identifier"
            ? fnNode.params[0].name
            : fnNode.params &&
                fnNode.params[0]?.type === "AssignmentPattern" &&
                fnNode.params[0].left?.type === "Identifier"
              ? fnNode.params[0].left.name
              : null;

    let bindingName: string | null = null;
    if (fnNode.type === "FunctionDeclaration" && fnNode.id?.type === "Identifier") {
        bindingName = fnNode.id.name;
    } else {
        const parentNode = fnPath.parentPath?.node;
        if (parentNode) {
            if (parentNode.type === "VariableDeclarator" && parentNode.id?.type === "Identifier") {
                bindingName = parentNode.id.name;
            } else if (parentNode.type === "AssignmentExpression" && parentNode.left?.type === "Identifier") {
                bindingName = parentNode.left.name;
            } else if (
                parentNode.type === "ObjectProperty" &&
                !parentNode.computed &&
                parentNode.key?.type === "Identifier"
            ) {
                bindingName = parentNode.key.name;
            }
        }
    }

    return { bindingName, firstParamName, node: fnNode, file };
};

/**
 * Walks an ObjectExpression and returns the property value node for the given
 * dotted property path (e.g. ["data"] → the value node of `data: ...`).
 */
const lookupObjectExpressionProp = (objExpr: any, propPath: string[]): any => {
    if (!objExpr || objExpr.type !== "ObjectExpression") return null;
    let current: any = objExpr;
    for (const segment of propPath) {
        if (!current || current.type !== "ObjectExpression") return null;
        let next: any = null;
        for (const prop of current.properties) {
            if (prop.type !== "ObjectProperty") continue;
            const key =
                prop.key.type === "Identifier"
                    ? prop.key.name
                    : prop.key.type === "StringLiteral"
                      ? prop.key.value
                      : null;
            if (key === segment) {
                next = prop.value;
                break;
            }
        }
        if (!next) return null;
        current = next;
    }
    return current;
};

/**
 * Resolves the value of `paramName.propPath` by walking back through the
 * enclosing function's callers. If a caller's argument is itself an Identifier
 * pointing to a constant initializer, we follow that binding; if it's the
 * caller's own first parameter, we recurse to that function's callers.
 */
export const resolveParamProperty = (
    paramName: string,
    propPath: string[],
    enclosingFn: EnclosingFn | null,
    getCallers: (bindingName: string) => CallerInfo[],
    depth = 0
): { node: any; scope: any; fileContent: string } | null => {
    if (!enclosingFn || !enclosingFn.bindingName || depth > 6) return null;
    if (enclosingFn.firstParamName !== paramName) return null;

    const callers = getCallers(enclosingFn.bindingName);
    if (!callers || callers.length === 0) return null;

    for (const caller of callers) {
        const arg = caller.args[0];
        if (!arg) continue;

        if (arg.type === "ObjectExpression") {
            const node = lookupObjectExpressionProp(arg, propPath);
            if (node) return { node, scope: caller.scope, fileContent: caller.fileContent };
        }

        if (arg.type === "Identifier") {
            const binding = caller.scope.getBinding(arg.name);
            const initNode = binding?.path?.node?.init;
            if (initNode && initNode.type === "ObjectExpression") {
                const node = lookupObjectExpressionProp(initNode, propPath);
                if (node) return { node, scope: caller.scope, fileContent: caller.fileContent };
            }
            if (caller.enclosingFn?.firstParamName === arg.name) {
                const result = resolveParamProperty(arg.name, propPath, caller.enclosingFn, getCallers, depth + 1);
                if (result) return result;
            }
        }
    }
    return null;
};

/**
 * Resolves [param:P] where P is the first param of enclosingFn — returns
 * the direct string value passed by the caller (not a property of it).
 */
const resolveFirstArg = (
    paramName: string,
    enclosingFn: EnclosingFn,
    getCallers: (name: string) => CallerInfo[],
    depth = 0
): string | null => {
    if (!enclosingFn.bindingName || enclosingFn.firstParamName !== paramName || depth > 4) return null;
    const callers = getCallers(enclosingFn.bindingName);
    for (const caller of callers) {
        const arg = caller.args[0];
        if (!arg) continue;
        const resolved = resolveNodeValue(arg, caller.scope, "", "fetch", caller.fileContent);
        if (typeof resolved === "string" && !resolved.startsWith("[") && resolved.length > 0) {
            return resolved;
        }
        if (arg.type === "Identifier") {
            const binding = caller.scope.getBinding(arg.name);
            const initNode = binding?.path?.node?.init;
            if (initNode) {
                const initResolved = resolveNodeValue(initNode, caller.scope, "", "fetch", caller.fileContent);
                if (typeof initResolved === "string" && !initResolved.startsWith("[") && initResolved.length > 0) {
                    return initResolved;
                }
            }
            if (caller.enclosingFn?.firstParamName === arg.name) {
                const r = resolveFirstArg(arg.name, caller.enclosingFn, getCallers, depth + 1);
                if (r) return r;
            }
        }
    }
    return null;
};

/**
 * Renders an ObjectExpression as a `k1={k1}&k2={k2}` query-string fragment.
 */
const renderObjectAsQuery = (objExpr: any, scope: any, fileContent: string): string | null => {
    if (!objExpr || objExpr.type !== "ObjectExpression") return null;
    const parts: string[] = [];
    for (const prop of objExpr.properties) {
        if (prop.type !== "ObjectProperty") continue;
        const key =
            prop.key.type === "Identifier" ? prop.key.name : prop.key.type === "StringLiteral" ? prop.key.value : null;
        if (!key) continue;
        let valStr: string;
        try {
            const resolved = resolveNodeValue(prop.value, scope, "", "fetch", fileContent);
            if (resolved !== null && resolved !== undefined && !String(resolved).startsWith("[")) {
                valStr = encodeURIComponent(String(resolved));
            } else {
                valStr = `{${key}}`;
            }
        } catch {
            valStr = `{${key}}`;
        }
        parts.push(`${key}=${valStr}`);
    }
    return parts.length > 0 ? parts.join("&") : null;
};

/**
 * Returns a plain object derived from an ObjectExpression's properties.
 * Spread elements are merged when they themselves resolve to a literal object;
 * otherwise the spread is preserved as a sentinel key.
 */
export const renderObjectExpression = (objExpr: any, scope: any, fileContent: string): Record<string, string> | null => {
    if (!objExpr || objExpr.type !== "ObjectExpression") return null;
    const out: Record<string, string> = {};
    for (const prop of objExpr.properties) {
        if (prop.type === "ObjectProperty") {
            const key =
                prop.key.type === "Identifier"
                    ? prop.key.name
                    : prop.key.type === "StringLiteral"
                      ? prop.key.value
                      : null;
            if (!key) continue;
            try {
                const resolved = resolveNodeValue(prop.value, scope, "", "fetch", fileContent);
                out[key] = resolved === undefined || resolved === null ? "" : String(resolved);
            } catch {
                out[key] = "";
            }
        } else if (prop.type === "SpreadElement") {
            try {
                const resolved = resolveNodeValue(prop.argument, scope, "", "fetch", fileContent);
                if (resolved && typeof resolved === "object") {
                    for (const [k, v] of Object.entries(resolved)) {
                        if (!(k in out)) out[k] = v === undefined || v === null ? "" : String(v);
                    }
                } else {
                    const chain = memberChainToString(prop.argument);
                    out[`...${chain ?? "spread"}`] = "<spread>";
                }
            } catch {
                const chain = memberChainToString(prop.argument);
                out[`...${chain ?? "spread"}`] = "<spread>";
            }
        }
    }
    return out;
};

export const renderValueNode = (node: any, scope: any, fileContent: string): string | null => {
    if (!node) return null;
    try {
        const resolved = resolveNodeValue(node, scope, "", "fetch", fileContent);
        if (resolved === null || resolved === undefined) return null;
        if (typeof resolved === "object") return null;
        const s = String(resolved);
        if (s.startsWith("[unresolved")) return null;
        return s;
    } catch {
        return null;
    }
};

/**
 * Substitutes [member:P.X], [urlsearchparams:P.X], and [param:P] markers in a
 * string by walking back to the enclosing function's caller(s).
 */
export const substituteCallerPlaceholders = (
    input: string,
    enclosingFn: EnclosingFn | null,
    getCallers: (bindingName: string) => CallerInfo[]
): string => {
    if (!input || !enclosingFn) return input;

    let output = input;

    output = output.replace(/\[urlsearchparams:([A-Za-z_$][\w$.]*)\]/g, (match, chain: string) => {
        const parts = chain.split(".");
        const paramName = parts[0];
        const propPath = parts.slice(1);
        const resolved = resolveParamProperty(paramName, propPath, enclosingFn, getCallers);
        if (!resolved) return match;
        const rendered = renderObjectAsQuery(resolved.node, resolved.scope, resolved.fileContent);
        return rendered ?? match;
    });

    output = output.replace(/\[member:([A-Za-z_$][\w$.]*)\]/g, (match, chain: string) => {
        const parts = chain.split(".");
        const paramName = parts[0];
        const propPath = parts.slice(1);
        const resolved = resolveParamProperty(paramName, propPath, enclosingFn, getCallers);
        if (!resolved) return match;
        const rendered = renderValueNode(resolved.node, resolved.scope, resolved.fileContent);
        return rendered ?? match;
    });

    // [param:P] — the URL/value IS the function parameter directly (not a property of it)
    output = output.replace(/\[param:([A-Za-z_$][\w$]*)\]/g, (match, paramName: string) => {
        const resolved = resolveFirstArg(paramName, enclosingFn, getCallers);
        return resolved ?? match;
    });

    return output;
};

/**
 * Substitutes placeholders in a header bag. `...P.X: <spread>` entries are
 * expanded when the corresponding caller-side value is a literal object.
 */
export const substituteCallerHeaders = (
    headers: Record<string, string>,
    enclosingFn: EnclosingFn | null,
    getCallers: (bindingName: string) => CallerInfo[]
): Record<string, string> => {
    if (!enclosingFn) return headers;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
        if (k.startsWith("...") && v === "<spread>") {
            const chain = k.slice(3);
            const parts = chain.split(".");
            const paramName = parts[0];
            const propPath = parts.slice(1);
            const resolved = resolveParamProperty(paramName, propPath, enclosingFn, getCallers);
            if (resolved && resolved.node.type === "ObjectExpression") {
                const obj = renderObjectExpression(resolved.node, resolved.scope, resolved.fileContent);
                if (obj) {
                    for (const [hk, hv] of Object.entries(obj)) {
                        if (!(hk in out)) out[hk] = hv;
                    }
                    continue;
                }
            }
            out[k] = v;
        } else {
            out[k] = substituteCallerPlaceholders(v, enclosingFn, getCallers);
        }
    }
    return out;
};

/**
 * Returns a getCallers function that searches the given file paths for call
 * sites of a named binding. Files are parsed on demand with a text pre-filter;
 * no ASTs are cached, so CallerInfo objects are only alive during the caller's
 * resolution pass and are then released to GC.
 *
 * Binding names with length ≤ 2 are skipped — they are minifier locals that
 * match too many call sites to be useful.
 */
export const makeGetCallers = (filePaths: string[], maxCallers = 64) => {
    return (bindingName: string): CallerInfo[] => {
        if (!bindingName || bindingName.length <= 2) return [];
        const needle = `${bindingName}(`;
        const out: CallerInfo[] = [];
        let overflowed = false;
        for (const filePath of filePaths) {
            if (overflowed) break;
            let fileContent: string;
            try {
                fileContent = fs.readFileSync(filePath, "utf-8");
            } catch {
                continue;
            }
            if (!fileContent.includes(needle)) continue;
            let fileAst: any;
            try {
                fileAst = parser.parse(fileContent, {
                    sourceType: "unambiguous",
                    plugins: ["jsx", "typescript"],
                    errorRecovery: true,
                });
            } catch {
                continue;
            }
            traverse(fileAst, {
                CallExpression(callPath: any) {
                    if (overflowed) {
                        callPath.stop();
                        return;
                    }
                    const callee = callPath.node.callee;
                    if (callee.type !== "Identifier" || callee.name !== bindingName) return;
                    if (out.length >= maxCallers) {
                        overflowed = true;
                        callPath.stop();
                        return;
                    }
                    out.push({
                        file: filePath,
                        fileContent,
                        callNode: callPath.node,
                        scope: callPath.scope,
                        args: callPath.node.arguments,
                        enclosingFn: inferEnclosingFn(callPath, filePath),
                    });
                },
            });
        }
        return overflowed ? [] : out;
    };
};
