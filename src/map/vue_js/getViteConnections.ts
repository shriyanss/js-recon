import fs from "fs";
import path from "path";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;
import chalk from "chalk";

import { Chunks } from "../../utility/interfaces.js";
import { File } from "@babel/types";
import * as globals from "../../utility/globals.js";
import { getCompletion } from "../../utility/ai.js";

const FUNC_NAME_RE = /^[a-zA-Z_]{2}$/;

interface FileMeta {
    something: string;
    hash: string;
}

const parseFilename = (filename: string): FileMeta | null => {
    const base = path.basename(filename);
    if (!base.endsWith(".js")) return null;
    let stem = base.slice(0, -3);
    if (stem.endsWith(".chunk")) {
        stem = stem.slice(0, -6);
    }
    const parts = stem.split(".");
    if (parts.length < 2) return null;
    const hash = parts[parts.length - 1];
    const something = parts.slice(0, -1).join(".");
    if (!something || !hash) return null;
    return { something, hash };
};

const getViteConnections = async (
    directory: string,
    output: string,
    formats: string[]
): Promise<Chunks> => {
    const maxAiThreads = globals.getAiThreads();
    if (globals.getAi().length > 0) {
        console.log(
            chalk.yellow(
                "[!] AI integration is enabled. This may incur costs. By using this feature, you agree to the AI provider's terms of service, and accept the risk of incurring unexpected costs due to huge codebase."
            )
        );
        const provider = globals.getAiServiceProvider();
        if (provider === "openai") {
            const apiKey = globals.getOpenaiApiKey() || process.env.OPENAI_API_KEY;
            if (!apiKey) {
                console.log(
                    chalk.red(
                        "[!] OpenAI API key not found. Please provide it via --openai-api-key or OPENAI_API_KEY environment variable."
                    )
                );
                process.exit(19);
            }
        }
        console.log(chalk.cyan(`[i] AI provider "${provider}" initialized.`));
    }

    // skip regeneration when an AI-tagged JSON already exists, since it would burn $$$
    if (fs.existsSync(`${output}.json`) && globals.getAi().length > 0) {
        console.log(
            chalk.yellow(`[!] Output file ${output}.json already exists. Skipping regeneration to save costs.`)
        );
        const chunks = JSON.parse(fs.readFileSync(`${output}.json`, "utf8"));
        return chunks;
    }

    console.log(chalk.cyan("[i] Getting Vite (Vue.JS) connections"));

    let files = fs.readdirSync(directory, {
        recursive: true,
        encoding: "utf8",
    }) as string[];

    files = files.filter((f) => f.endsWith(".js") && !f.includes("___subsequent_requests"));
    files = files.filter((f) => !fs.lstatSync(path.join(directory, f)).isDirectory());

    const fileMeta = new Map<string, FileMeta>();
    const somethingCount = new Map<string, number>();
    for (const file of files) {
        const meta = parseFilename(file);
        if (!meta) continue;
        fileMeta.set(file, meta);
        somethingCount.set(meta.something, (somethingCount.get(meta.something) || 0) + 1);
    }

    const computeChunkKey = (funcName: string, meta: FileMeta): string => {
        const isDistinct = somethingCount.get(meta.something) === 1;
        const suffix = isDistinct ? meta.something.slice(0, 4) : meta.hash.slice(0, 4);
        return `${funcName}__${suffix}`;
    };

    const chunks: Chunks = {};
    const fileFuncToChunkId = new Map<string, Map<string, string>>();

    // Pass 1: find every root-level 2-char function and create a chunk entry
    console.log(chalk.cyan(`[i] Scanning ${files.length} JS files for root functions`));
    for (const file of files) {
        const meta = fileMeta.get(file);
        if (!meta) continue;

        const filePath = path.join(directory, file);
        let code: string;
        try {
            code = fs.readFileSync(filePath, "utf8");
        } catch {
            continue;
        }

        let ast: parser.ParseResult<File>;
        try {
            ast = parser.parse(code, {
                sourceType: "unambiguous",
                plugins: ["jsx", "typescript"],
                errorRecovery: true,
            });
        } catch {
            continue;
        }

        const fileFuncs = new Map<string, string>();
        fileFuncToChunkId.set(file, fileFuncs);

        for (const node of ast.program.body) {
            if (node.type !== "FunctionDeclaration") continue;
            if (!node.id || !FUNC_NAME_RE.test(node.id.name)) continue;
            const funcName = node.id.name;
            const key = computeChunkKey(funcName, meta);
            if (chunks[key]) continue;
            const funcCode = code.slice(node.start ?? 0, node.end ?? 0);
            chunks[key] = {
                id: key,
                description: "none",
                loadedOn: [],
                containsFetch: false,
                isAxiosLibrary: false,
                exports: [],
                callStack: [],
                code: funcCode,
                imports: [],
                file: file,
            };
            fileFuncs.set(funcName, key);
        }
    }

    // Build basename -> file path lookup for import resolution
    const pathByNormalized = new Map<string, string>();
    for (const file of files) {
        pathByNormalized.set(path.normalize(file), file);
    }

    const resolveImportSource = (importingFile: string, source: string): string | null => {
        if (!source.startsWith(".") && !source.startsWith("/")) return null;
        const fileDir = path.dirname(importingFile);
        const resolved = path.normalize(path.join(fileDir, source));
        return pathByNormalized.get(resolved) ?? null;
    };

    // Pass 2: resolve imports and exports for each chunk
    console.log(chalk.cyan("[i] Resolving imports and exports"));
    for (const file of files) {
        const meta = fileMeta.get(file);
        if (!meta) continue;

        const fileFuncs = fileFuncToChunkId.get(file);
        if (!fileFuncs || fileFuncs.size === 0) continue;

        const filePath = path.join(directory, file);
        let code: string;
        try {
            code = fs.readFileSync(filePath, "utf8");
        } catch {
            continue;
        }

        let ast: parser.ParseResult<File>;
        try {
            ast = parser.parse(code, {
                sourceType: "unambiguous",
                plugins: ["jsx", "typescript"],
                errorRecovery: true,
            });
        } catch {
            continue;
        }

        const importMap = new Map<string, { source: string; original: string }>();
        const exportMap = new Map<string, string[]>();

        for (const node of ast.program.body) {
            if (node.type === "ImportDeclaration") {
                const source = node.source.value;
                for (const spec of node.specifiers) {
                    if (spec.type === "ImportSpecifier") {
                        const importedName =
                            spec.imported.type === "Identifier"
                                ? spec.imported.name
                                : spec.imported.value;
                        importMap.set(spec.local.name, { source, original: importedName });
                    } else if (spec.type === "ImportDefaultSpecifier") {
                        importMap.set(spec.local.name, { source, original: "default" });
                    } else if (spec.type === "ImportNamespaceSpecifier") {
                        importMap.set(spec.local.name, { source, original: "*" });
                    }
                }
            } else if (node.type === "ExportNamedDeclaration" && !node.declaration) {
                for (const spec of node.specifiers) {
                    if (spec.type !== "ExportSpecifier") continue;
                    const localName = spec.local.name;
                    const exportedAs =
                        spec.exported.type === "Identifier"
                            ? spec.exported.name
                            : spec.exported.value;
                    const arr = exportMap.get(localName) ?? [];
                    arr.push(exportedAs);
                    exportMap.set(localName, arr);
                }
            }
        }

        for (const [funcName, chunkId] of fileFuncs.entries()) {
            const exportNames = exportMap.get(funcName);
            if (exportNames) chunks[chunkId].exports = exportNames;
        }

        traverse(ast, {
            FunctionDeclaration(funcPath) {
                if (funcPath.parent.type !== "Program") return;
                const name = funcPath.node.id?.name;
                if (!name || !FUNC_NAME_RE.test(name)) return;
                const chunkId = fileFuncs.get(name);
                if (!chunkId) return;

                const importsSet = new Set<string>();
                funcPath.traverse({
                    Identifier(idPath) {
                        const idName = idPath.node.name;
                        if (!importMap.has(idName)) return;
                        // skip identifiers that aren't references (property names, etc.)
                        const parent = idPath.parent;
                        if (
                            parent.type === "MemberExpression" &&
                            parent.property === idPath.node &&
                            !parent.computed
                        )
                            return;
                        if (
                            parent.type === "ObjectProperty" &&
                            parent.key === idPath.node &&
                            !parent.computed
                        )
                            return;
                        const { source, original } = importMap.get(idName)!;
                        const resolvedFile = resolveImportSource(file, source);
                        if (!resolvedFile) return;
                        const targetMap = fileFuncToChunkId.get(resolvedFile);
                        if (!targetMap) return;
                        const targetId = targetMap.get(original);
                        if (targetId) importsSet.add(targetId);
                    },
                });

                chunks[chunkId].imports = Array.from(importsSet);
            },
        });
    }

    console.log(chalk.green(`[✓] Found ${Object.keys(chunks).length} Vue.JS functions`));

    // if AI description is enabled, generate descriptions for each chunk in parallel batches
    if (globals.getAi() && globals.getAi().includes("description")) {
        console.log(chalk.cyan("[i] Generating descriptions for chunks"));
        const chunkEntries = Object.entries(chunks);
        const descriptionPromises: Promise<{ key: string; description: string }>[] = [];
        let activeThreads = 0;
        const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
        const systemPrompt =
            "You are a code analyzer. You will be given a function from a Vite-bundled Vue.JS application. You have to generate a one-liner description of what the function does.";

        for (const [key, value] of chunkEntries) {
            while (activeThreads >= maxAiThreads) {
                await sleep(Math.floor(Math.random() * 451) + 50);
            }

            activeThreads++;
            const promise = (async () => {
                try {
                    const description = await getCompletion(value.code, systemPrompt);
                    return { key, description };
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    console.log(chalk.red(`[!] Error generating description for chunk ${key}: ${msg}`));
                    return { key, description: "none" };
                } finally {
                    activeThreads--;
                }
            })();
            descriptionPromises.push(promise);
        }

        const results = await Promise.all(descriptionPromises);

        results.forEach(({ key, description }) => {
            if (chunks[key]) {
                chunks[key].description = description || "none";
                console.log(chalk.green(`[✓] Generated description for ${key}: ${chunks[key].description}`));
            }
        });
    }

    if (formats.includes("json")) {
        const chunksJson = JSON.stringify(chunks, null, 2);
        fs.writeFileSync(`${output}.json`, chunksJson);
        console.log(chalk.green(`[✓] Saved Vite connections to ${output}.json`));
    }

    return chunks;
};

export default getViteConnections;
