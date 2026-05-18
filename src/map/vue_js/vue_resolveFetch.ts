import chalk from "chalk";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import fs from "fs";
import path from "path";
import { resolveNodeValue, substituteVariablesInString } from "../next_js/utils.js";
import * as globals from "../../utility/globals.js";

const traverse = _traverse.default;

/**
 * Scans all JS files in the given directory for fetch() calls,
 * resolves their URL / method / headers / body, and registers each
 * call with the OpenAPI output collector.
 *
 * Designed for Vite-bundled Vue.JS applications where HTTP calls are
 * made with the native fetch() API rather than via webpack chunks.
 */
const vue_resolveFetch = async (directory: string): Promise<void> => {
    console.log(chalk.cyan("[i] Resolving Vue.JS fetch instances"));

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

    let totalFetchCalls = 0;

    for (const file of files) {
        const filePath = path.join(directory, file);
        let fileContent: string;
        try {
            fileContent = fs.readFileSync(filePath, "utf-8");
        } catch {
            continue;
        }

        // Fast path: skip files with no fetch keyword at all
        if (!fileContent.includes("fetch")) continue;

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

        // Collect fetch aliases (const x = fetch)
        const fetchAliases = new Set<any>();
        traverse(fileAst, {
            VariableDeclarator(p) {
                const { id, init } = p.node;
                if (id.type !== "Identifier" || !init) return;
                if (init.type === "Identifier" && init.name === "fetch") {
                    const binding = p.scope.getBinding(id.name);
                    if (binding) fetchAliases.add(binding);
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
                console.log(chalk.blue(`[+] Found fetch call in "${filePath}":${fileLine}`));
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

                console.log(chalk.green(`    URL: ${url}`));

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

                        console.log(chalk.green(`    Method: ${method}`));
                        if (Object.keys(headers).length > 0)
                            console.log(chalk.green(`    Headers: ${JSON.stringify(headers)}`));
                        if (body) console.log(chalk.green(`    Body: ${body}`));
                    }
                }

                globals.addOpenapiOutput({
                    url: String(url),
                    method,
                    path: String(url),
                    headers,
                    body,
                    chunkId: file,
                    functionFile: filePath,
                    functionFileLine: fileLine,
                });
            },
        });
    }

    console.log(chalk.green(`[✓] Found and resolved ${totalFetchCalls} fetch call(s) across Vue.JS files`));
};

export default vue_resolveFetch;
