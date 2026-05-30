import chalk from "chalk";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import fs from "fs";
import path from "path";
import { resolveNodeValue, substituteVariablesInString, memberChainToString } from "../next_js/utils.js";
import * as globals from "../../utility/globals.js";

const traverse = _traverse.default;

/**
 * Checks whether invoking the given function body would directly execute a
 * `fetch(...)` call (as a bare Identifier callee). Used to recognise functions
 * that wrap the native fetch API so destructured aliases of those wrappers can
 * be resolved as fetch calls.
 *
 * The walk stops at nested function boundaries so a factory function that
 * RETURNS a fetch-wrapping arrow isn't itself classified as a wrapper — only
 * the arrow it returns is.
 */
const NESTED_FN_TYPES = new Set(["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"]);

/**
 * A function is treated as a "transparent" fetch wrapper only if its first
 * argument is forwarded as-is to fetch as the URL. Wrappers that construct the
 * URL from a property of their input object have a different calling convention
 * than `fetch(url, options)` — treating callsites of those as fetch calls
 * produces garbage URLs. So we require that fetch's first arg is the function's
 * first param (an Identifier match).
 */
const bodyCallsFetch = (functionNode: any): boolean => {
    if (!functionNode || typeof functionNode !== "object") return false;
    const params = Array.isArray(functionNode.params) ? functionNode.params : [];
    const firstParamName =
        params[0] && params[0].type === "Identifier"
            ? params[0].name
            : params[0] && params[0].type === "AssignmentPattern" && params[0].left?.type === "Identifier"
              ? params[0].left.name
              : null;
    if (!firstParamName) return false;

    let found = false;
    const visit = (n: any, depth: number) => {
        if (found || !n || typeof n !== "object") return;
        if (Array.isArray(n)) {
            for (const child of n) visit(child, depth);
            return;
        }
        if (typeof n.type !== "string") return;
        // Don't descend into nested functions — they have their own invocation context.
        if (depth > 0 && NESTED_FN_TYPES.has(n.type)) return;
        if (
            n.type === "CallExpression" &&
            n.callee &&
            n.callee.type === "Identifier" &&
            n.callee.name === "fetch" &&
            Array.isArray(n.arguments) &&
            n.arguments.length > 0 &&
            n.arguments[0].type === "Identifier" &&
            n.arguments[0].name === firstParamName
        ) {
            found = true;
            return;
        }
        for (const key of Object.keys(n)) {
            if (
                key === "loc" ||
                key === "start" ||
                key === "end" ||
                key === "leadingComments" ||
                key === "trailingComments"
            ) {
                continue;
            }
            visit(n[key], depth + 1);
        }
    };
    visit(functionNode, 0);
    return found;
};

const isFunctionLike = (node: any): boolean =>
    !!node &&
    (node.type === "ArrowFunctionExpression" ||
        node.type === "FunctionExpression" ||
        node.type === "FunctionDeclaration");

interface EnclosingFn {
    bindingName: string | null;
    firstParamName: string | null;
    node: any;
    file: string;
}

interface CallerInfo {
    file: string;
    fileContent: string;
    callNode: any;
    scope: any;
    args: any[];
    // Function that contains this call — used for transitive resolution when
    // the call's argument is itself the enclosing function's parameter.
    enclosingFn: EnclosingFn | null;
}

interface FetchEntry {
    file: string;
    filePath: string;
    fileContent: string;
    fileLine: number;
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
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
const inferEnclosingFn = (callPath: any, file: string): EnclosingFn | null => {
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
 * Walks an ObjectExpression and returns the property value for the given
 * dotted property path (e.g. ["data"] -> the value node of `data: ...`).
 * Returns null if any segment of the path isn't a literal property.
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
 *
 * Returns the resolved AST node + the scope it lives in (so further sub-property
 * resolution can use the correct binding lookup), or null when the chain breaks.
 */
const resolveParamProperty = (
    paramName: string,
    propPath: string[],
    enclosingFn: EnclosingFn | null,
    getCallers: (bindingName: string) => CallerInfo[],
    depth: number = 0
): { node: any; scope: any; fileContent: string } | null => {
    if (!enclosingFn || !enclosingFn.bindingName || depth > 6) return null;
    // Only the function's first parameter is supported for now — every observed
    // case has fetch wrappers shaped as `(e) => fetch(... e.X ...)`.
    if (enclosingFn.firstParamName !== paramName) return null;

    const callers = getCallers(enclosingFn.bindingName);
    if (!callers || callers.length === 0) return null;

    for (const caller of callers) {
        const arg = caller.args[0];
        if (!arg) continue;

        // Case 1: caller passes an object literal directly — fn({ a: ..., b: ... })
        if (arg.type === "ObjectExpression") {
            const node = lookupObjectExpressionProp(arg, propPath);
            if (node) return { node, scope: caller.scope, fileContent: caller.fileContent };
        }

        // Case 2: caller passes an Identifier pointing to a const-initialized
        // object literal — `const x = { a: ... }; fn(x)`.
        if (arg.type === "Identifier") {
            const binding = caller.scope.getBinding(arg.name);
            const initNode = binding?.path?.node?.init;
            if (initNode && initNode.type === "ObjectExpression") {
                const node = lookupObjectExpressionProp(initNode, propPath);
                if (node) return { node, scope: caller.scope, fileContent: caller.fileContent };
            }
            // Case 3: caller passes its own first param straight through —
            // `outer = (p) => fn(p)`. Recurse up to that function's callers.
            if (caller.enclosingFn?.firstParamName === arg.name) {
                const result = resolveParamProperty(arg.name, propPath, caller.enclosingFn, getCallers, depth + 1);
                if (result) return result;
            }
        }
    }
    return null;
};

/**
 * Renders an ObjectExpression as a `k1={k1}&k2={k2}` query-string fragment.
 * Literal property values are URL-encoded directly; non-literal values fall
 * back to the placeholder form so the schema reader can see what's missing.
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
 * Spread elements are merged in when they themselves resolve to a literal
 * object; otherwise the spread is preserved as a sentinel key so the schema
 * reader knows extra fields exist at runtime.
 */
const renderObjectExpression = (objExpr: any, scope: any, fileContent: string): Record<string, string> | null => {
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

/**
 * Tries to convert a value node into a printable string, transparently
 * unwrapping template literals built from caller-side bindings. Returns null
 * when the value is itself a Vue-style ref / member expression that we can't
 * pin down statically.
 */
const renderValueNode = (node: any, scope: any, fileContent: string): string | null => {
    if (!node) return null;
    try {
        const resolved = resolveNodeValue(node, scope, "", "fetch", fileContent);
        if (resolved === null || resolved === undefined) return null;
        if (typeof resolved === "object") {
            // Avoid emitting `[object Object]` — leave it to the upstream
            // placeholder so the consumer knows it's structured.
            return null;
        }
        const s = String(resolved);
        if (s.startsWith("[unresolved")) return null;
        return s;
    } catch {
        return null;
    }
};

/**
 * Substitutes [member:P.X], [param:P], and [urlsearchparams:P.X] markers in a
 * string by walking back to the enclosing function's caller(s). The string is
 * returned with as many markers resolved as we could trace.
 */
const substituteCallerPlaceholders = (
    input: string,
    enclosingFn: EnclosingFn | null,
    getCallers: (bindingName: string) => CallerInfo[]
): string => {
    if (!input || !enclosingFn) return input;

    let output = input;

    output = output.replace(/\[urlsearchparams:([A-Za-z_$][\w$.]*)\]/g, (match, chain: string) => {
        const parts = chain.split(".");
        if (parts.length < 1) return match;
        const paramName = parts[0];
        const propPath = parts.slice(1);
        const resolved = resolveParamProperty(paramName, propPath, enclosingFn, getCallers);
        if (!resolved) return match;
        const rendered = renderObjectAsQuery(resolved.node, resolved.scope, resolved.fileContent);
        return rendered ?? match;
    });

    output = output.replace(/\[member:([A-Za-z_$][\w$.]*)\]/g, (match, chain: string) => {
        const parts = chain.split(".");
        if (parts.length < 1) return match;
        const paramName = parts[0];
        const propPath = parts.slice(1);
        const resolved = resolveParamProperty(paramName, propPath, enclosingFn, getCallers);
        if (!resolved) return match;
        const rendered = renderValueNode(resolved.node, resolved.scope, resolved.fileContent);
        return rendered ?? match;
    });

    return output;
};

/**
 * Substitutes placeholders in a header bag. `...P.X: <spread>` entries are
 * expanded when the corresponding caller-side value is a literal object;
 * `[member:P.X]` markers inside header values are substituted in-place.
 */
const substituteCallerHeaders = (
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
 * Scans all JS files in the given directory for fetch() calls,
 * resolves their URL / method / headers / body, and registers each
 * call with the OpenAPI output collector.
 *
 * Designed for Vite-bundled Vue.JS applications where HTTP calls are
 * made with the native fetch() API rather than via webpack chunks.
 */
const vue_resolveFetch = async (directory: string, frameworkName = "Vue.JS"): Promise<void> => {
    console.log(chalk.cyan(`[i] Resolving ${frameworkName} fetch instances`));

    let files: string[];
    try {
        files = fs.readdirSync(directory, { recursive: true, encoding: "utf8" }) as string[];
    } catch {
        console.log(chalk.red(`[!] Could not read directory: ${directory}`));
        return;
    }

    files = files
        .filter((f) => f.endsWith(".js") && !f.includes("___subsequent_requests"))
        .filter((f) => !fs.lstatSync(path.join(directory, f)).isDirectory());

    // Pre-pass: scan every file for object-literal properties whose value is a
    // function that ultimately calls fetch(). Their property names are the
    // fetch-wrapper keys downstream code destructures and invokes in place of
    // fetch — so we need to recognise those aliases.
    //
    // ASTs are parsed on-demand and discarded after each file — only
    // `wrapperKeyNames` (a small string set) and `fetchFilePaths` (a path list)
    // are retained so that the full pre-pass AST set never lives in memory
    // simultaneously.
    const wrapperKeyNames = new Set<string>();
    const fetchFilePaths: string[] = [];

    for (let _pi = 0; _pi < files.length; _pi++) {
        // Yield to the event loop every 50 files so V8 GC can reclaim ASTs
        // from completed iterations before the next batch begins.
        if (_pi > 0 && _pi % 50 === 0) await new Promise<void>((r) => setImmediate(r));
        const file = files[_pi];
        const filePath = path.join(directory, file);
        let fileContent: string;
        try {
            fileContent = fs.readFileSync(filePath, "utf-8");
        } catch {
            continue;
        }
        if (!fileContent.includes("fetch")) continue;
        fetchFilePaths.push(filePath);
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
            ObjectProperty(p) {
                const key = p.node.key;
                const value: any = p.node.value;
                if (!isFunctionLike(value)) return;
                if (!bodyCallsFetch(value)) return;
                const keyName = key.type === "Identifier" ? key.name : key.type === "StringLiteral" ? key.value : null;
                if (keyName) wrapperKeyNames.add(keyName);
            },
        });
        // fileAst and fileContent go out of scope here — GC can reclaim them.
    }

    // Caller lookup — searches fetchFilePaths on demand, no persistent cache.
    //
    // The previous design used a callerCache (Map<bindingName, CallerInfo[]>) so
    // repeated lookups for the same name were free. The problem: CallerInfo holds
    // live Babel AST node references (callNode, scope, args). A cached CallerInfo
    // keeps the entire file AST alive for the lifetime of vue_resolveFetch, which
    // can be hundreds of large parsed ASTs simultaneously → OOM.
    //
    // Without caching, each getCallers call is self-contained: the CallerInfo
    // objects are returned, used immediately in resolveParamProperty, and then
    // become garbage — the AST node refs they hold are released promptly.
    //
    // Short (≤2 char) binding names are minifier locals that match thousands of
    // call sites; they always overflow MAX_CALLERS_PER_NAME and return [] anyway,
    // so we short-circuit before touching any file.
    const MAX_CALLERS_PER_NAME = 64;
    const getCallers = (bindingName: string): CallerInfo[] => {
        if (!bindingName || bindingName.length <= 2) return [];
        const needle = `${bindingName}(`;
        const out: CallerInfo[] = [];
        let overflowed = false;
        for (const filePath of fetchFilePaths) {
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
                CallExpression(callPath) {
                    if (overflowed) {
                        callPath.stop();
                        return;
                    }
                    const callee = callPath.node.callee;
                    if (callee.type !== "Identifier" || callee.name !== bindingName) return;
                    if (out.length >= MAX_CALLERS_PER_NAME) {
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
            // fileAst local goes out of scope here. If CallerInfo objects in out[]
            // hold node refs from this file, those keep the AST alive only until
            // the caller uses out[] and discards it (no long-lived cache).
        }
        // A name with this many callsites is almost certainly a minifier
        // single-letter local (e, t, n, …) — tracing it is noise, not signal.
        return overflowed ? [] : out;
    };

    let totalFetchCalls = 0;
    // Counter for per-callsite uniqueness so two callsites at the same path+method
    // are kept distinct in mapped.json and downstream specs.
    let callsiteCounter = 0;
    const entries: FetchEntry[] = [];

    for (let _mi = 0; _mi < files.length; _mi++) {
        // Yield every 50 files so V8 GC can run between batches.
        if (_mi > 0 && _mi % 50 === 0) await new Promise<void>((r) => setImmediate(r));
        const file = files[_mi];
        const filePath = path.join(directory, file);
        // Parse each file fresh — no persistent cache. The AST goes out of scope
        // at the end of this loop body so the GC can reclaim it.
        let fileContent: string;
        let fileAst: any;
        try {
            fileContent = fs.readFileSync(filePath, "utf-8");
        } catch {
            continue;
        }
        if (!fileContent.includes("fetch")) continue;
        try {
            fileAst = parser.parse(fileContent, {
                sourceType: "unambiguous",
                plugins: ["jsx", "typescript"],
                errorRecovery: true,
            });
        } catch {
            continue;
        }

        // Collect fetch aliases:
        //   1. `const x = fetch` (direct identifier aliasing)
        //   2. `const x = (i, l) => fetch(i, l)` (function-literal wrappers)
        //   3. `const { wrapperKey: x } = factory({...})` (destructured wrapper keys)
        const fetchAliases = new Set<any>();
        traverse(fileAst, {
            VariableDeclarator(p) {
                const { id, init } = p.node;
                if (!init) return;

                if (id.type === "Identifier") {
                    if (init.type === "Identifier" && init.name === "fetch") {
                        const binding = p.scope.getBinding(id.name);
                        if (binding) fetchAliases.add(binding);
                        return;
                    }
                    if (isFunctionLike(init) && bodyCallsFetch(init)) {
                        const binding = p.scope.getBinding(id.name);
                        if (binding) fetchAliases.add(binding);
                        return;
                    }
                }

                if (id.type === "ObjectPattern") {
                    for (const prop of id.properties) {
                        if (prop.type !== "ObjectProperty") continue;
                        const keyName =
                            prop.key.type === "Identifier"
                                ? prop.key.name
                                : prop.key.type === "StringLiteral"
                                  ? prop.key.value
                                  : null;
                        if (!keyName || !wrapperKeyNames.has(keyName)) continue;
                        const valueName = prop.value.type === "Identifier" ? prop.value.name : null;
                        if (!valueName) continue;
                        const binding = p.scope.getBinding(valueName);
                        if (binding) fetchAliases.add(binding);
                    }
                }
            },
        });

        // Resolve each fetch call
        traverse(fileAst, {
            CallExpression(callPath) {
                const callee = callPath.node.callee;
                let isFetchCall = false;

                if (callee.type === "Identifier" && callee.name === "fetch") {
                    isFetchCall = true;
                } else if (callee.type === "Identifier") {
                    const binding = callPath.scope.getBinding(callee.name);
                    if (binding && fetchAliases.has(binding)) isFetchCall = true;
                }

                if (!isFetchCall) return;

                const args = callPath.node.arguments;
                if (args.length === 0) return;

                const fileLine = callPath.node.loc?.start.line ?? 0;
                totalFetchCalls++;

                // Resolve URL (first argument)
                const urlArgCode = fileContent
                    .slice((args[0] as any).start, (args[0] as any).end)
                    .replace(/\n\s*/g, "");

                let url: any = resolveNodeValue(args[0], callPath.scope, urlArgCode, "fetch", fileContent);

                if (typeof url === "string" && (url.includes("[var ") || url.includes("[MemberExpression"))) {
                    const substituted = substituteVariablesInString(url, fileContent);
                    if (substituted !== url) {
                        console.log(chalk.cyan(`    [i] Resolved variables in URL: ${url} -> ${substituted}`));
                        url = substituted;
                    }
                }

                let method = "GET";
                let headers: Record<string, string> = {};
                let body = "";

                if (args.length > 1) {
                    const options: any = resolveNodeValue(args[1], callPath.scope, "", "fetch", fileContent);

                    if (typeof options === "object" && options !== null) {
                        method = options.method || "GET";

                        if (options.headers && typeof options.headers === "object") {
                            const resolvedHeaders: Record<string, string> = {};
                            for (const [k, v] of Object.entries(options.headers)) {
                                const rk =
                                    typeof k === "string" ? substituteVariablesInString(k, fileContent) : String(k);
                                const rv =
                                    typeof v === "string" ? substituteVariablesInString(v, fileContent) : String(v);
                                resolvedHeaders[rk] = rv;
                            }
                            headers = resolvedHeaders;
                        }

                        if (options.body) {
                            body =
                                typeof options.body === "object" ? JSON.stringify(options.body) : String(options.body);
                        }
                    }
                }

                const rawEnclosingFn = inferEnclosingFn(callPath, filePath);
                // Null out the AST node reference — it is never read in the
                // second pass, but keeping it alive would pin the entire file
                // AST in memory through the entries array.
                const enclosingFn = rawEnclosingFn
                    ? { ...rawEnclosingFn, node: null }
                    : null;

                entries.push({
                    file,
                    filePath,
                    // fileContent is not used in the second pass; store an empty
                    // string so the full file content is not kept alive in memory
                    // through the entries array.
                    fileContent: "",
                    fileLine,
                    url: typeof url === "string" ? url : "",
                    method,
                    headers,
                    body,
                    enclosingFn,
                });
            },
        });
    }

    // Second pass: walk back to each fetch's enclosing function callers and
    // substitute markers we couldn't resolve in the first pass. This is where
    // `?[urlsearchparams:p.q]` turns into `?k1={k1}&k2={k2}`, and where
    // `...p.q: <spread>` gets expanded if a literal object was passed.
    //
    // [param:...] markers are NOT handled by substituteCallerPlaceholders, so
    // excluding them from the guard avoids triggering an expensive (and fruitless)
    // caller search for wrapper functions whose first arg is a plain parameter.
    const MARKER_RE = /\[(urlsearchparams|member):/;
    const headersHaveMarkers = (h: Record<string, string>): boolean => {
        for (const [k, v] of Object.entries(h)) {
            if (k.startsWith("...") && v === "<spread>") return true;
            if (MARKER_RE.test(v)) return true;
        }
        return false;
    };

    for (const entry of entries) {
        if (
            entry.enclosingFn &&
            entry.enclosingFn.bindingName &&
            entry.enclosingFn.firstParamName &&
            // Skip minifier-generated short names — getCallers returns [] for
            // them anyway (see the short-circuit inside getCallers), but avoiding
            // the call entirely saves the regex test overhead on large entry lists.
            entry.enclosingFn.bindingName.length > 2 &&
            (MARKER_RE.test(entry.url) || MARKER_RE.test(entry.body) || headersHaveMarkers(entry.headers))
        ) {
            entry.url = substituteCallerPlaceholders(entry.url, entry.enclosingFn, getCallers);
            entry.headers = substituteCallerHeaders(entry.headers, entry.enclosingFn, getCallers);
            entry.body = substituteCallerPlaceholders(entry.body, entry.enclosingFn, getCallers);
        }

        console.log(chalk.blue(`[+] Found fetch call in "${entry.filePath}":${entry.fileLine}`));
        console.log(chalk.green(`    URL: ${entry.url}`));
        if (entry.method !== "GET" || Object.keys(entry.headers).length > 0 || entry.body) {
            console.log(chalk.green(`    Method: ${entry.method}`));
        }
        if (Object.keys(entry.headers).length > 0)
            console.log(chalk.green(`    Headers: ${JSON.stringify(entry.headers)}`));
        if (entry.body) console.log(chalk.green(`    Body: ${entry.body}`));

        // Skip the openapi/postman registration for callsites where the URL
        // never resolved to anything URL-shaped. Examples:
        //   - inner wrapper bodies like `fetch(i, l)` where `i` is a param
        //   - non-string AST nodes (objects, member expressions) that have
        //     no chance of being a real path
        const urlStr = entry.url;
        const looksLikeUrl =
            urlStr.length > 0 &&
            !urlStr.startsWith("[") &&
            urlStr !== "[object Object]" &&
            (urlStr.startsWith("http://") ||
                urlStr.startsWith("https://") ||
                urlStr.startsWith("/") ||
                /^[A-Za-z0-9_\-.]+\//.test(urlStr));
        if (!looksLikeUrl) continue;

        callsiteCounter++;
        globals.addOpenapiOutput({
            url: urlStr,
            method: entry.method,
            path: urlStr,
            headers: entry.headers,
            body: entry.body,
            chunkId: `${entry.file}:${entry.fileLine}`,
            functionFile: entry.filePath,
            functionFileLine: entry.fileLine,
        });
    }

    console.log(chalk.green(`[✓] Found and resolved ${totalFetchCalls} fetch call(s) across ${frameworkName} files`));
};

export default vue_resolveFetch;
