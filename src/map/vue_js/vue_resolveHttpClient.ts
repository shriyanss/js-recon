import chalk from "chalk";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import fs from "fs";
import path from "path";
import { resolveNodeValue, substituteVariablesInString } from "../next_js/utils.js";
import * as globals from "../../utility/globals.js";
import {
    EnclosingFn,
    inferEnclosingFn,
    substituteCallerPlaceholders,
    substituteCallerHeaders,
    makeGetCallers,
    enclosingFnChainHasBinding,
    GetCallersFn,
} from "./taint_utils.js";
import { deepResolveValue, mapLeafStrings, hasMarkers } from "./bodyResolver.js";

const stripAstNodes = (fn: EnclosingFn | null): EnclosingFn | null => {
    if (!fn) return null;
    const root: EnclosingFn = { ...fn, node: null };
    let cur: EnclosingFn = root;
    let src: EnclosingFn | null | undefined = fn.parent;
    while (src) {
        cur.parent = { ...src, node: null };
        cur = cur.parent;
        src = src.parent;
    }
    return root;
};

const traverse = _traverse.default;

const HTTP_VERBS = new Set(["get", "post", "put", "delete", "patch", "head", "options"]);

interface HttpCallEntry {
    file: string;
    filePath: string;
    fileLine: number;
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
    /**
     * Structured form of `body` when the request body resolves to an object.
     * Preserved separately so taint substitution can rewrite leaf-string
     * markers (`[param:X]`, `[member:P.X]`, …) without parsing JSON.
     */
    bodyValue?: any;
    enclosingFn: EnclosingFn | null;
}

/**
 * Heuristic: only treat a resolved string as a URL if, after stripping every
 * `[…]` placeholder produced by resolveNodeValue, the remaining literal text
 * still contains a `/` separator or an explicit scheme. This rejects calls on
 * Map/Set/Headers/EventBus (`x.get("key")`, `bus.post(event)`) while keeping
 * partial URLs like `[call:base()]<literal>/[param:e]/[param:t]`.
 */
const looksLikeUrl = (s: string): boolean => {
    if (!s) return false;
    if (s.startsWith("http://") || s.startsWith("https://")) return true;
    const stripped = s.replace(/\[[^\]]*\]/g, "");
    return stripped.includes("/");
};

/**
 * Recovers `[unresolved: NAME]` placeholders by chasing later assignments to
 * NAME within the enclosing function. Pattern: `let ue; …; ue = e + "/" + t;`
 * — babel's binding has no `init`, so resolveNodeValue returns the unresolved
 * marker. The assignment shows up under `binding.constantViolations`.
 *
 * Iterates until no further substitutions are made (an assignment may itself
 * resolve to a string containing more unresolved markers).
 */
/**
 * Enumerates every concrete URL obtainable by substituting `[param:X]`
 * placeholders with the resolved values from each caller of the enclosing
 * function chain. Returns an empty array if no `[param:X]` markers are
 * present (caller falls back to the single-result substituter).
 *
 * Walks up to 5 levels deep to chain across nested wrappers
 * (callback → wrapper → exported method → external caller).
 */
const expandParamPlaceholders = (
    url: string,
    fn: EnclosingFn | null,
    getCallers: GetCallersFn,
    depth = 0
): string[] => {
    if (depth > 3 || typeof url !== "string") return [];
    const all = url.match(/\[param:([A-Za-z_$][\w$]*)\]/g);
    if (!all) return [url];

    // Pick the first placeholder; find the function in the chain that
    // declares it. Then substitute *every* placeholder owned by that same
    // function from a single caller's args, so multi-param URLs like
    // `…/[param:e]/[param:t]` stay consistent across one caller.
    const firstName = all[0].slice("[param:".length, -1);
    let owner: EnclosingFn | null | undefined = fn;
    while (owner && (!owner.bindingName || !(owner.paramNames ?? []).includes(firstName))) {
        owner = owner.parent ?? null;
    }
    if (!owner || !owner.bindingName) return [url];

    const ownerParams = owner.paramNames ?? [];
    const ownedNames = new Set<string>();
    for (const m of all) {
        const n = m.slice("[param:".length, -1);
        if (ownerParams.includes(n)) ownedNames.add(n);
    }

    const callers = getCallers(owner.bindingName, owner.file);
    if (!callers || callers.length === 0) return [url];

    const out = new Set<string>();
    for (const caller of callers) {
        let nextUrl = url;
        let hasArgs = false;
        for (const name of ownedNames) {
            const idx = ownerParams.indexOf(name);
            const arg = caller.args[idx];
            if (!arg) continue;
            hasArgs = true;
            let resolved: any;
            try {
                resolved = resolveNodeValue(arg, caller.scope, "", "fetch", caller.fileContent);
            } catch {
                continue;
            }
            if (resolved === null || resolved === undefined) continue;
            const resolvedStr = typeof resolved === "string" ? resolved : String(resolved);
            nextUrl = nextUrl.split(`[param:${name}]`).join(resolvedStr);
        }
        if (!hasArgs) continue;
        // Recurse so forwarding wrappers (where the caller's arg is itself a
        // `[param:Y]` placeholder) walk up one more level into the caller's
        // own enclosing function callers. Bounded by depth guard at the top.
        if (!/\[param:/.test(nextUrl)) {
            out.add(nextUrl);
        } else {
            const subs = expandParamPlaceholders(nextUrl, caller.enclosingFn, getCallers, depth + 1);
            for (const s of subs) out.add(s);
        }
    }
    return out.size === 0 ? [url] : Array.from(out);
};

const UNRESOLVED_IDENT_RE = /\[unresolved: ([A-Za-z_$][\w$]*)\]/g;
const resolveFromAssignments = (s: string, scope: any, fileContent: string): string => {
    if (typeof s !== "string" || !s) return s;
    let prev: string | null = null;
    let out = s;
    let guard = 0;
    while (prev !== out && guard < 6) {
        prev = out;
        guard++;
        out = out.replace(UNRESOLVED_IDENT_RE, (orig, name: string) => {
            try {
                const binding = scope?.getBinding?.(name);
                if (!binding) return orig;
                for (const vp of binding.constantViolations ?? []) {
                    const n = vp.node;
                    if (n?.type !== "AssignmentExpression" || n.operator !== "=") continue;
                    if (n.left?.type !== "Identifier" || n.left.name !== name) continue;
                    const r = resolveNodeValue(n.right, vp.scope, "", "fetch", fileContent);
                    if (typeof r === "string" && r.length > 0 && !r.startsWith("[unresolved")) return r;
                }
            } catch {}
            return orig;
        });
    }
    return out;
};

/**
 * Generic HTTP-client call resolver for Vite/webpack bundles where the actual
 * `new XMLHttpRequest()` lives inside a transport library (axios's xhrAdapter,
 * Got, Ky, custom wrappers). At that depth the URL resolves only to
 * `[member:re.url]` from a dispatcher config object, which is useless on its
 * own.
 *
 * Instead we walk every `<obj>.<verb>(<url>, ...)` callsite where <verb> is a
 * known HTTP method name. The URL is resolved through the existing
 * resolveNodeValue + substituteVariablesInString machinery, and the
 * `looksLikeUrl` heuristic filters out unrelated method calls (Map.get,
 * Headers.delete, EventBus.post, …).
 *
 * A second-pass taint analysis walks back to each call's enclosing function
 * callers to substitute [param:X] / [member:P.X] / [urlsearchparams:P.X]
 * placeholders. This is the same chain `vue_resolveXhr` already uses.
 */
const vue_resolveHttpClient = async (directory: string, frameworkName = "Vue.JS"): Promise<void> => {
    console.log(chalk.cyan(`[i] Resolving ${frameworkName} HTTP client method calls`));

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

    const allFilePaths = files.map((f) => path.join(directory, f));
    const getCallers = makeGetCallers(allFilePaths);

    const entries: HttpCallEntry[] = [];
    const verbPrefilter = /\.(?:get|post|put|delete|patch|head|options)\s*\(/;

    for (let _i = 0; _i < files.length; _i++) {
        if (_i > 0 && _i % 50 === 0) await new Promise<void>((r) => setImmediate(r));

        const file = files[_i];
        const filePath = path.join(directory, file);

        let fileContent: string;
        try {
            fileContent = fs.readFileSync(filePath, "utf-8");
        } catch {
            continue;
        }

        if (!verbPrefilter.test(fileContent)) continue;

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
            CallExpression(p) {
                const callee = p.node.callee;
                if (callee.type !== "MemberExpression" || callee.computed) return;
                const prop = callee.property;
                if (prop.type !== "Identifier") return;
                const verb = prop.name;
                if (!HTTP_VERBS.has(verb)) return;

                const args = p.node.arguments;
                if (args.length === 0) return;

                const obj = callee.object;
                if (obj.type === "ThisExpression") return;
                if (obj.type === "StringLiteral" || obj.type === "TemplateLiteral") return;

                const rawUrl = resolveNodeValue(args[0], p.scope, "", "fetch", fileContent);
                let url = typeof rawUrl === "string" ? rawUrl : "";
                if (url.includes("[var ") || url.includes("[MemberExpression")) {
                    url = substituteVariablesInString(url, fileContent);
                }
                url = resolveFromAssignments(url, p.scope, fileContent);
                if (!looksLikeUrl(url)) return;

                let body = "";
                let bodyValue: any = undefined;
                const headers: Record<string, string> = {};
                const hasBody = verb === "post" || verb === "put" || verb === "patch";
                const configArgIndex = hasBody ? 2 : 1;

                if (hasBody && args.length >= 2) {
                    bodyValue = deepResolveValue(args[1], p.scope, fileContent);
                    body =
                        bodyValue === null || bodyValue === undefined
                            ? ""
                            : typeof bodyValue === "object"
                              ? JSON.stringify(bodyValue)
                              : String(bodyValue);
                }

                const configArg = args[configArgIndex];
                if (configArg && configArg.type === "ObjectExpression") {
                    for (const cp of configArg.properties) {
                        if (cp.type !== "ObjectProperty") continue;
                        const k =
                            cp.key.type === "Identifier"
                                ? cp.key.name
                                : cp.key.type === "StringLiteral"
                                  ? cp.key.value
                                  : null;
                        if (k !== "headers") continue;
                        if (cp.value.type !== "ObjectExpression") continue;
                        for (const hp of cp.value.properties) {
                            if (hp.type !== "ObjectProperty") continue;
                            const hk =
                                hp.key.type === "Identifier"
                                    ? hp.key.name
                                    : hp.key.type === "StringLiteral"
                                      ? hp.key.value
                                      : null;
                            if (!hk) continue;
                            const rawV = resolveNodeValue(hp.value, p.scope, "", "fetch", fileContent);
                            headers[hk] =
                                typeof rawV === "string"
                                    ? substituteVariablesInString(rawV, fileContent)
                                    : String(rawV ?? "");
                        }
                    }
                }

                const line = p.node.loc?.start.line ?? 0;
                const enclosingFn = stripAstNodes(inferEnclosingFn(p, filePath));

                entries.push({
                    file,
                    filePath,
                    fileLine: line,
                    url,
                    method: verb.toUpperCase(),
                    headers,
                    body,
                    bodyValue,
                    enclosingFn,
                });
            },
        });
    }

    // Taint-analysis second pass — same machinery as vue_resolveXhr.
    const MARKER_RE = /\[(urlsearchparams|member|param):/;
    const headersHaveMarkers = (h: Record<string, string>): boolean => {
        for (const [k, v] of Object.entries(h)) {
            if (k.startsWith("...") && v === "<spread>") return true;
            if (MARKER_RE.test(v)) return true;
        }
        return false;
    };

    // Apply caller-side substitution to every leaf string inside a structured
    // body. Then JSON.stringify the result so it round-trips through the
    // string-typed `body` field. Plain-string bodies fall back to the existing
    // single-pass substituter.
    const substituteBody = (
        entry: HttpCallEntry,
        enclosingFn: EnclosingFn | null
    ): { body: string; bodyValue: any } => {
        if (entry.bodyValue !== undefined && entry.bodyValue !== null && typeof entry.bodyValue === "object") {
            const next = mapLeafStrings(entry.bodyValue, (s) =>
                substituteCallerPlaceholders(s, enclosingFn, getCallers)
            );
            return { body: JSON.stringify(next), bodyValue: next };
        }
        return {
            body: substituteCallerPlaceholders(entry.body, enclosingFn, getCallers),
            bodyValue: entry.bodyValue,
        };
    };

    // Expand `[param:X]` URLs across every caller of the enclosing function so
    // a single wrapper site (e.g. an internal `client.post(base+"path/"+ns+"/"+m, …)`)
    // generates one emitted URL per caller — capturing distinct namespace/method
    // pairs instead of just whichever resolved first.
    const expandedEntries: HttpCallEntry[] = [];
    for (const entry of entries) {
        if (
            enclosingFnChainHasBinding(entry.enclosingFn) &&
            (MARKER_RE.test(entry.url) ||
                MARKER_RE.test(entry.body) ||
                hasMarkers(entry.bodyValue) ||
                headersHaveMarkers(entry.headers))
        ) {
            const urls = expandParamPlaceholders(entry.url, entry.enclosingFn, getCallers);
            if (urls.length === 0) {
                entry.url = substituteCallerPlaceholders(entry.url, entry.enclosingFn, getCallers);
                const subBody = substituteBody(entry, entry.enclosingFn);
                entry.body = subBody.body;
                entry.bodyValue = subBody.bodyValue;
                entry.headers = substituteCallerHeaders(entry.headers, entry.enclosingFn, getCallers);
                expandedEntries.push(entry);
            } else {
                const subBody = substituteBody(entry, entry.enclosingFn);
                const headersSub = substituteCallerHeaders(entry.headers, entry.enclosingFn, getCallers);
                for (const u of urls) {
                    expandedEntries.push({
                        ...entry,
                        url: u,
                        body: subBody.body,
                        bodyValue: subBody.bodyValue,
                        headers: headersSub,
                    });
                }
            }
        } else {
            expandedEntries.push(entry);
        }
    }
    entries.length = 0;
    entries.push(...expandedEntries);

    let emitted = 0;
    for (const entry of entries) {
        if (!looksLikeUrl(entry.url)) continue;
        console.log(
            chalk.blue(`[+] Found ${entry.method} client call in "${entry.filePath}":${entry.fileLine}`)
        );
        console.log(chalk.green(`    URL: ${entry.url}`));
        if (Object.keys(entry.headers).length > 0) {
            console.log(chalk.green(`    Headers: ${JSON.stringify(entry.headers)}`));
        }
        if (entry.body) console.log(chalk.green(`    Body: ${entry.body}`));

        globals.addOpenapiOutput({
            url: entry.url,
            method: entry.method,
            path: entry.url,
            headers: entry.headers,
            body: entry.body,
            chunkId: `${entry.file}:${entry.fileLine}`,
            functionFile: entry.filePath,
            functionFileLine: entry.fileLine,
        });
        emitted++;
    }

    console.log(
        chalk.green(`[✓] Emitted ${emitted} HTTP client call(s) across ${frameworkName} files`)
    );
};

export default vue_resolveHttpClient;
