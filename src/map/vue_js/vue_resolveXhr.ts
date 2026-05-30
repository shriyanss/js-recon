import chalk from "chalk";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import fs from "fs";
import path from "path";
import { resolveNodeValue, substituteVariablesInString } from "../next_js/utils.js";
import * as globals from "../../utility/globals.js";

const traverse = _traverse.default;

interface XhrEntry {
    file: string;
    filePath: string;
    fileLine: number;
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
}

/**
 * Scans all JS files in the given directory for XMLHttpRequest usage,
 * resolves the URL / method / headers / body from the .open() / .setRequestHeader()
 * / .send() call chain, and registers each call with the OpenAPI output collector.
 *
 * The resolution strategy tracks every binding assigned a `new XMLHttpRequest()`
 * instance and then collects the corresponding .open(), .setRequestHeader(), and
 * .send() calls on that same binding within the enclosing function scope.
 *
 * Memory design mirrors vue_resolveFetch: ASTs are parsed per-file and freed
 * immediately after each iteration; no persistent AST cache is maintained.
 */
const vue_resolveXhr = async (directory: string, frameworkName = "Vue.JS"): Promise<void> => {
    console.log(chalk.cyan(`[i] Resolving ${frameworkName} XMLHttpRequest instances`));

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

    let totalXhrCalls = 0;
    const entries: XhrEntry[] = [];

    for (let _i = 0; _i < files.length; _i++) {
        // Yield to the event loop every 50 files so V8 GC can reclaim ASTs
        // from completed iterations before the next batch begins.
        if (_i > 0 && _i % 50 === 0) await new Promise<void>((r) => setImmediate(r));

        const file = files[_i];
        const filePath = path.join(directory, file);

        let fileContent: string;
        try {
            fileContent = fs.readFileSync(filePath, "utf-8");
        } catch {
            continue;
        }

        // Fast pre-filter: skip files that can't possibly contain XHR usage.
        if (!fileContent.includes("XMLHttpRequest")) continue;

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

        // Pass 1: find every binding assigned `new XMLHttpRequest()`.
        // Maps local variable name → set of scopes where it is bound so we can
        // match the subsequent .open() / .setRequestHeader() / .send() calls.
        const xhrBindingNames = new Set<string>();

        traverse(fileAst, {
            NewExpression(p) {
                const callee = p.node.callee;
                if (callee.type !== "Identifier" || callee.name !== "XMLHttpRequest") return;

                // Pattern: var/let/const x = new XMLHttpRequest()
                const parent = p.parent;
                if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
                    xhrBindingNames.add(parent.id.name);
                    return;
                }
                // Pattern: x = new XMLHttpRequest()  (assignment expression)
                if (parent.type === "AssignmentExpression" && parent.left.type === "Identifier") {
                    xhrBindingNames.add(parent.left.name);
                    return;
                }
            },
        });

        if (xhrBindingNames.size === 0) {
            // AST freed here
            continue;
        }

        // Pass 2: for each XHR binding, collect .open(), .setRequestHeader(),
        // and .send() calls. We group them by binding name. Within the same
        // enclosing function a binding is typically used for a single request;
        // if reused for multiple requests we emit one entry per .open() call.
        //
        // Data collected per binding:
        //   openCalls:    [{method, url, line}]
        //   headers:      {name: value}  (accumulated from all setRequestHeader calls)
        //   bodies:       [bodyString]   (from .send())

        interface XhrCallData {
            method: string;
            url: string;
            line: number;
            headers: Record<string, string>;
            body: string;
        }

        // binding name → list of request snapshots (one per .open() call)
        const xhrCallMap = new Map<string, XhrCallData[]>();
        // binding name → current accumulator (reset on each .open() call)
        const xhrAccum = new Map<string, { headers: Record<string, string>; body: string }>();

        for (const name of xhrBindingNames) {
            xhrCallMap.set(name, []);
            xhrAccum.set(name, { headers: {}, body: "" });
        }

        traverse(fileAst, {
            CallExpression(p) {
                const callee = p.node.callee;
                if (callee.type !== "MemberExpression") return;
                const obj = callee.object;
                const prop = callee.property;
                if (obj.type !== "Identifier") return;
                if (!xhrBindingNames.has(obj.name)) return;
                if (prop.type !== "Identifier") return;

                const methodName = prop.name;
                const args = p.node.arguments;

                if (methodName === "open") {
                    // open(method, url[, async])
                    if (args.length < 2) return;

                    const rawMethod = resolveNodeValue(args[0], p.scope, "", "fetch", fileContent);
                    const rawUrl = resolveNodeValue(args[1], p.scope, "", "fetch", fileContent);

                    let method = typeof rawMethod === "string" ? rawMethod.toUpperCase() : "GET";
                    if (!["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"].includes(method)) {
                        method = typeof rawMethod === "string" ? rawMethod : "GET";
                    }

                    let url = typeof rawUrl === "string" ? rawUrl : "";
                    if (url.includes("[var ") || url.includes("[MemberExpression")) {
                        url = substituteVariablesInString(url, fileContent);
                    }

                    const line = p.node.loc?.start.line ?? 0;

                    // Flush previous accumulator into the call list, start fresh
                    const accum = xhrAccum.get(obj.name)!;
                    xhrCallMap.get(obj.name)!.push({
                        method,
                        url,
                        line,
                        headers: { ...accum.headers },
                        body: accum.body,
                    });
                    // Reset accumulator for the next .open() on the same binding
                    xhrAccum.set(obj.name, { headers: {}, body: "" });
                } else if (methodName === "setRequestHeader") {
                    // setRequestHeader(name, value)
                    if (args.length < 2) return;
                    const rawName = resolveNodeValue(args[0], p.scope, "", "fetch", fileContent);
                    const rawValue = resolveNodeValue(args[1], p.scope, "", "fetch", fileContent);
                    const headerName =
                        typeof rawName === "string"
                            ? substituteVariablesInString(rawName, fileContent)
                            : String(rawName ?? "");
                    const headerValue =
                        typeof rawValue === "string"
                            ? substituteVariablesInString(rawValue, fileContent)
                            : String(rawValue ?? "");
                    xhrAccum.get(obj.name)!.headers[headerName] = headerValue;
                } else if (methodName === "send") {
                    // send([body])
                    if (args.length > 0) {
                        const rawBody = resolveNodeValue(args[0], p.scope, "", "fetch", fileContent);
                        const bodyStr =
                            rawBody === null || rawBody === undefined
                                ? ""
                                : typeof rawBody === "object"
                                  ? JSON.stringify(rawBody)
                                  : String(rawBody);
                        xhrAccum.get(obj.name)!.body = bodyStr;
                    }
                }
            },
        });

        // Merge accumulated headers/body into each open() entry.
        // The traverse visitor processes statements in source order, so by the
        // time we visit .send() the accum already has the correct headers from
        // all prior .setRequestHeader() calls for this request.  However, because
        // we push on .open() (before .send() is seen), we need a second merge.
        for (const [bindingName, calls] of xhrCallMap.entries()) {
            const accum = xhrAccum.get(bindingName)!;
            if (calls.length > 0) {
                // Merge final accumulator state into the last .open() entry
                const last = calls[calls.length - 1];
                for (const [k, v] of Object.entries(accum.headers)) {
                    if (!(k in last.headers)) last.headers[k] = v;
                }
                if (!last.body && accum.body) last.body = accum.body;
            }

            for (const call of calls) {
                totalXhrCalls++;
                entries.push({
                    file,
                    filePath,
                    fileLine: call.line,
                    url: call.url,
                    method: call.method,
                    headers: call.headers,
                    body: call.body,
                });
            }
        }

        // fileAst and fileContent go out of scope here — GC can reclaim them.
    }

    // Output and register with OpenAPI collector
    for (const entry of entries) {
        console.log(chalk.blue(`[+] Found XHR call in "${entry.filePath}":${entry.fileLine}`));
        console.log(chalk.green(`    URL: ${entry.url}`));
        if (entry.method !== "GET" || Object.keys(entry.headers).length > 0 || entry.body) {
            console.log(chalk.green(`    Method: ${entry.method}`));
        }
        if (Object.keys(entry.headers).length > 0) {
            console.log(chalk.green(`    Headers: ${JSON.stringify(entry.headers)}`));
        }
        if (entry.body) console.log(chalk.green(`    Body: ${entry.body}`));

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

    console.log(chalk.green(`[✓] Found and resolved ${totalXhrCalls} XHR call(s) across ${frameworkName} files`));
};

export default vue_resolveXhr;
