import chalk from "chalk";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { Chunks } from "../utility/interfaces.js";
import prettier from "prettier";

// Next.js
import refactorNext from "./next/index.js";
// React
import refactorReact, { RefactorReactResult } from "./react/index.js";
import type { LibraryModuleInfo } from "./react/library-classify.js";

// Remote HuggingFace client + cache
import { TECH_TO_BRANCH, getHfRawUrl, fetchCollisionsJson, listCollisionsFiles, validateRemoteBranch, getSampleSize, getTechnology, CollisionRecord } from "./remote/hf-client.js";
import { loadRefactorConfig, validateRefactorConfig } from "./remote/config.js";
import { loadListCache, saveListCache, shouldRefreshListCache, loadCachedSignature, saveSignatureToCache, isSignatureCacheFresh, validateCaches } from "./remote/cache.js";

/**
 * Derives the assets directory from the URL embedded in any chunk's code comment.
 * Chunks have a header like `// File Source: http://localhost:3001/assets/foo.js`.
 * Returns null if the assets directory cannot be determined or does not exist.
 */
function findAssetsDir(chunks: Chunks, mappedJsonPath: string): string | null {
    for (const chunk of Object.values(chunks)) {
        const firstLine = (chunk.code ?? "").split("\n")[0];
        const urlMatch = firstLine.match(/\/\/ File Source: (https?:\/\/[^\s]+)/);
        if (!urlMatch) continue;
        try {
            const url = new URL(urlMatch[1]);
            const port = url.port;
            const hostname = url.hostname + (port ? `_${port}` : "");
            const assetsDir = path.join(path.dirname(path.resolve(mappedJsonPath)), "output", hostname, "assets");
            if (fs.existsSync(assetsDir)) return assetsDir;
        } catch {
            continue;
        }
    }
    return null;
}

/**
 * Returns paths to .js files in `assetsDir` that are NOT covered by any chunk in `chunks`.
 * Chunks cover a file when `path.basename(chunk.file)` matches the assets filename.
 */
function findVendorChunkFiles(chunks: Chunks, assetsDir: string): string[] {
    const coveredFiles = new Set<string>();
    for (const chunk of Object.values(chunks)) {
        if (chunk.file) coveredFiles.add(path.basename(chunk.file));
    }
    return fs
        .readdirSync(assetsDir)
        .filter((f) => f.endsWith(".js") && !coveredFiles.has(f))
        .map((f) => path.join(assetsDir, f));
}

// Maps a refactor tech to the scat-combo directory name in a baseline tree.
// Must match LIB_SIG_SCAT in src/refactor/<tech>/index.ts (sorted alphabetically, joined with "-").
const BASELINE_SCAT_DIR: Record<string, string> = {
    "react-webpack": "lit-decl-loop-cond",
};

type LibSigsResult = { sigs: Set<string>; desc: string };

export type RemoteLibSigsOptions = {
    signatureQuality: number; // 0-100; default 100
    refreshCache: boolean;
    skipCacheChecks: boolean;
};

// Parses a collisions.json file and returns signatures whose count equals the maximum.
const loadCollisionsFile = (filePath: string): Set<string> => {
    const records = JSON.parse(fs.readFileSync(filePath, "utf8")) as Array<{
        signature: string;
        count: number;
    }>;
    const maxCount = records.reduce((m, r) => (r.count > m ? r.count : m), 0);
    return new Set(records.filter((r) => r.count >= maxCount).map((r) => r.signature));
};

// Resolves `--collisions <path>` to a library signature set. Accepts:
//   - a file path → reads directly (max-count signatures)
//   - a standard directory → tries known candidate paths in order:
//       <dir>/baselines/<tech>/<scat>/collisions.json
//       <dir>/<tech>/<scat>/collisions.json
//       <dir>/<scat>/collisions.json
//       <dir>/collisions.json
//   - a per-feature results directory → detects <dir>/<feature>/<scat>/collisions.json
//       and intersects max-count signatures across all feature subdirs (reads only
//       the relevant scat files, not the full dataset tree)
const buildLibSigs = (input: string, tech: string): LibSigsResult | null => {
    if (!fs.existsSync(input)) return null;
    const stat = fs.statSync(input);
    const scat = BASELINE_SCAT_DIR[tech];

    // Case 1: direct file path
    if (stat.isFile()) {
        return { sigs: loadCollisionsFile(input), desc: input };
    }

    // Case 2: standard directory candidates (existing layout)
    const candidates = [
        scat ? path.join(input, "baselines", tech, scat, "collisions.json") : null,
        scat ? path.join(input, tech, scat, "collisions.json") : null,
        scat ? path.join(input, scat, "collisions.json") : null,
        path.join(input, "collisions.json"),
    ].filter(Boolean) as string[];
    for (const c of candidates) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) {
            return { sigs: loadCollisionsFile(c), desc: c };
        }
    }

    // Case 3: per-feature results directory — <dir>/<feature>/<scat>/collisions.json
    // Only the scat-relevant files are read (one per feature subdir), so memory usage
    // stays low even when the full dataset tree is hundreds of gigabytes.
    if (scat) {
        const featureFiles: string[] = [];
        for (const entry of fs.readdirSync(input, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const p = path.join(input, entry.name, scat, "collisions.json");
            if (fs.existsSync(p)) featureFiles.push(p);
        }
        if (featureFiles.length > 0) {
            // Intersect max-count signatures across all feature subdirs.
            // A signature present in every feature's max-count set must come from
            // code shared by all apps — i.e. library code.
            let intersection: Set<string> | null = null;
            for (const p of featureFiles) {
                const sigs = loadCollisionsFile(p);
                if (intersection === null) {
                    intersection = sigs;
                } else {
                    for (const sig of intersection) {
                        if (!sigs.has(sig)) intersection.delete(sig);
                    }
                }
            }
            if (intersection && intersection.size > 0) {
                return {
                    sigs: intersection,
                    desc: `${input} (intersection of ${featureFiles.length} feature dirs)`,
                };
            }
        }
    }

    return null;
};

// Loads library signatures from the remote HuggingFace dataset.
// Returns null if the branch is not configured for `tech` or if validation fails.
const loadRemoteLibSigs = async (
    tech: string,
    opts: RemoteLibSigsOptions
): Promise<LibSigsResult | null> => {
    const branch = TECH_TO_BRANCH[tech];
    if (!branch) return null;

    const scatDir = BASELINE_SCAT_DIR[tech];
    if (!scatDir) return null;

    // Load and validate config.
    const config = loadRefactorConfig();
    const configWarnings = validateRefactorConfig(config);
    for (const w of configWarnings) {
        console.log(chalk.yellow(`[!] Refactor config warning: ${w}`));
    }

    // Validate cache files.
    const cacheWarnings = validateCaches();
    for (const w of cacheWarnings) {
        console.log(chalk.yellow(`[!] Cache validation warning: ${w} (will refresh)`));
    }

    // Validate remote bucket prefix has required metadata files.
    console.log(chalk.cyan(`[i] Validating remote bucket prefix "${branch}"...`));
    const branchOk = await validateRemoteBranch(branch);
    if (!branchOk) {
        console.log(chalk.red(`[!] Remote bucket prefix "${branch}" is missing required metadata (sample_size / technology). Skipping remote signatures.`));
        return null;
    }

    // Verify the bucket prefix technology matches.
    const remoteTech = await getTechnology(branch);
    if (remoteTech !== tech) {
        console.log(chalk.red(`[!] Remote bucket prefix "${branch}" is for technology "${remoteTech}", not "${tech}". Skipping remote signatures.`));
        return null;
    }

    const sampleSize = await getSampleSize(branch);

    // Build / refresh file list cache.
    let listCache = cacheWarnings.length > 0 ? null : loadListCache();
    if (shouldRefreshListCache(listCache, opts)) {
        console.log(chalk.cyan(`[i] Refreshing remote file list cache for bucket prefix "${branch}"...`));
        const paths = await listCollisionsFiles(branch, scatDir);
        const now = Date.now();
        const branches: Record<string, string[]> = listCache?.branches ?? {};
        branches[branch] = paths;
        listCache = { generatedAt: now, branches };
        saveListCache(listCache);
        console.log(chalk.cyan(`[i] File list cache updated: ${paths.length} files found`));
    }

    const filePaths: string[] = listCache?.branches[branch] ?? [];
    // Filter to only paths that match <something>/<scatDir>/collisions.json
    const matchingPaths = filePaths.filter((p) => p.endsWith(`/${scatDir}/collisions.json`));

    if (matchingPaths.length === 0) {
        console.log(chalk.yellow(`[!] No remote collisions files found for scat "${scatDir}" in branch "${branch}"`));
        return null;
    }

    console.log(chalk.cyan(`[i] Loading ${matchingPaths.length} remote signature files (quality threshold: ${opts.signatureQuality}%)...`));

    let intersection: Set<string> | null = null;
    let loadedCount = 0;

    for (const relPath of matchingPaths) {
        let records: CollisionRecord[] | null = null;

        // Check local signature cache first.
        if (isSignatureCacheFresh(branch, relPath, opts.skipCacheChecks)) {
            records = loadCachedSignature(branch, relPath);
        }

        if (records === null) {
            // Fetch from remote.
            const url = getHfRawUrl(branch, relPath);
            records = await fetchCollisionsJson(url);

            if (records === null) {
                // 404 or error — invalidate list cache unless skip-cache-checks.
                if (!opts.skipCacheChecks) {
                    console.log(chalk.yellow(`[!] Could not fetch ${relPath} (404 or error) — refreshing list cache`));
                    const freshPaths = await listCollisionsFiles(branch, scatDir);
                    const updatedBranches = listCache?.branches ?? {};
                    updatedBranches[branch] = freshPaths;
                    saveListCache({ generatedAt: Date.now(), branches: updatedBranches });
                    listCache = { generatedAt: Date.now(), branches: updatedBranches };
                }
                continue;
            }

            saveSignatureToCache(branch, relPath, records, config.maxCacheSizeMb);
        }

        // Apply signature quality filter: (count / sampleSize) * 100 >= threshold
        const filtered = records.filter(
            (r) => sampleSize > 0 && (r.count / sampleSize) * 100 >= opts.signatureQuality
        );

        // Intersect with previous sets.
        const sigSet = new Set(filtered.map((r) => r.signature));
        if (intersection === null) {
            intersection = sigSet;
        } else {
            for (const sig of intersection) {
                if (!sigSet.has(sig)) intersection.delete(sig);
            }
        }

        loadedCount++;
    }

    if (!intersection || intersection.size === 0) {
        console.log(chalk.yellow(`[!] Remote signatures loaded but intersection is empty (quality threshold may be too high)`));
        return null;
    }

    console.log(chalk.cyan(`[i] Loaded ${intersection.size} library signatures from remote (${loadedCount} files, bucket prefix: ${branch})`));
    return { sigs: intersection, desc: `remote:${branch} (${loadedCount} files, quality>=${opts.signatureQuality}%)` };
};

const availableTechs = {
    next: "Next.js",
    "react-webpack": "React (webpack)",
};

/**
 * Scaffolds a minimal webpack project in `outputDir` (package.json,
 * webpack.config.js, index.html), then runs `npm install` + `npm run build`
 * as a build check.  Uses babel-loader so JSX in .js files is handled without
 * renaming.
 *
 * The entry file is the first written file that contains `createRoot(` — i.e.
 * the app entry point.  If no such file is found, the first written file is used.
 */
function runBuildCheck(outputDir: string, writtenFiles: string[]): void {
    if (writtenFiles.length === 0) return;

    // Find the entry file: the module that calls createRoot().
    const entryFile = writtenFiles.find((f) => {
        try { return fs.readFileSync(f, "utf8").includes("createRoot("); }
        catch { return false; }
    }) ?? writtenFiles[0];
    const entryRelative = `./${path.basename(entryFile)}`;

    console.log(chalk.cyan(`[i] Setting up webpack build check in ${outputDir}/ (entry: ${entryRelative})`));

    // package.json — no "type": "module" so webpack.config.js can use CommonJS require
    const pkg = {
        name: "refactored-app",
        version: "1.0.0",
        scripts: { build: "webpack" },
        dependencies: {
            react: "^18.3.1",
            "react-dom": "^18.3.1",
            "react-router-dom": "^6.27.0",
        },
        devDependencies: {
            "@babel/core": "^7.25.0",
            "@babel/preset-env": "^7.25.0",
            "@babel/preset-react": "^7.25.0",
            "babel-loader": "^9.2.1",
            "html-webpack-plugin": "^5.6.0",
            webpack: "^5.95.0",
            "webpack-cli": "^5.1.4",
        },
    };
    fs.writeFileSync(path.join(outputDir, "package.json"), JSON.stringify(pkg, null, 2));

    // webpack.config.js — babel-loader with preset-react handles JSX in .js files
    const webpackConfig = `const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
module.exports = {
  mode: 'production',
  entry: '${entryRelative}',
  output: { path: path.resolve(__dirname, 'dist'), filename: 'bundle.js', clean: true },
  module: {
    rules: [{
      test: /\\.jsx?$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: [
            ['@babel/preset-env', { targets: 'defaults' }],
            ['@babel/preset-react', { runtime: 'automatic' }],
          ],
        },
      },
    }],
  },
  resolve: { extensions: ['.js', '.jsx'] },
  plugins: [new HtmlWebpackPlugin({ template: './index.html' })],
};
`;
    fs.writeFileSync(path.join(outputDir, "webpack.config.js"), webpackConfig);

    // index.html — HtmlWebpackPlugin injects the bundle script automatically
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>Refactored App</title></head>
  <body><div id="root"></div></body>
</html>
`;
    fs.writeFileSync(path.join(outputDir, "index.html"), indexHtml);

    console.log(chalk.cyan("[i] Installing dependencies..."));
    try {
        execSync("npm install", { cwd: outputDir, stdio: "inherit" });
    } catch {
        console.log(chalk.red("[!] npm install failed — skipping build check"));
        return;
    }

    console.log(chalk.cyan("[i] Running build check..."));
    try {
        execSync("npm run build", { cwd: outputDir, stdio: "inherit" });
        console.log(chalk.green("[✓] Build check passed"));
    } catch {
        console.log(chalk.red("[!] Build check failed — review output above"));
    }
}

/**
 * Refactors JavaScript code chunks based on technology-specific patterns.
 *
 * This function takes mapped code chunks and applies technology-specific refactoring
 * rules to improve code readability, remove obfuscation, and standardize formatting.
 * The refactored code is written to individual files in the output directory.
 *
 * @param mappedJson - Path to the mapped JSON file containing code chunks
 * @param outputDir - Directory where refactored code files will be written
 * @param tech - Technology stack identifier (e.g., 'next' for Next.js)
 * @param list - Whether to list available technologies instead of running refactoring
 * @returns Promise that resolves when refactoring is complete
 */
const refactor = async (
    mappedJson: string,
    outputDir: string,
    tech: string,
    list: boolean,
    collisionsFile?: string,
    remoteOpts?: RemoteLibSigsOptions & { noRemote?: boolean }
): Promise<void> => {
    console.log(chalk.cyan("[i] Loading refactor module..."));

    if (list) {
        console.log(chalk.cyan("[i] Listing available technologies"));
        for (const key of Object.keys(availableTechs) as Array<keyof typeof availableTechs>) {
            console.log(chalk.green(`- ${key}: ${availableTechs[key]}`));
        }
        return;
    }

    // check if the file exists
    if (!fs.existsSync(mappedJson)) {
        console.error(chalk.red("[!] Mapped JSON file does not exist"));
        process.exit(7);
    }

    // verify if the tech provided is valid
    if (!Object.keys(availableTechs).includes(tech)) {
        console.error(chalk.red("[!] Invalid technology provided"));
        process.exit(8);
    }

    // check if the output directory already exists
    if (fs.existsSync(outputDir)) {
        console.error(chalk.red("[!] Output directory already exists"));
        process.exit(9);
    } else {
        fs.mkdirSync(outputDir);
    }

    // read the mapped JSON file
    const chunks: Chunks = JSON.parse(fs.readFileSync(mappedJson, "utf8"));

    // Load CS-MAST cross-app baseline signatures.
    // Priority: --collisions (local path) > remote HF (default) > none.
    let libSigs: Set<string> | undefined;
    if (collisionsFile) {
        // Explicit local path — use existing resolver unchanged.
        const result = buildLibSigs(collisionsFile, tech);
        if (!result) {
            console.log(chalk.red(`[!] Could not resolve library signatures from: ${collisionsFile}`));
            const scat = BASELINE_SCAT_DIR[tech];
            if (scat) {
                console.log(
                    chalk.red(
                        `    accepted layouts:\n` +
                            `      <file>                                           (direct collisions.json)\n` +
                            `      <dir>/baselines/${tech}/${scat}/collisions.json\n` +
                            `      <dir>/${tech}/${scat}/collisions.json\n` +
                            `      <dir>/${scat}/collisions.json\n` +
                            `      <dir>/collisions.json\n` +
                            `      <dir>/<feature>/${scat}/collisions.json          (per-feature results dir)`
                    )
                );
            }
            process.exit(10);
        }
        libSigs = result.sigs;
        console.log(chalk.cyan(`[i] Loaded ${libSigs.size} library signatures from ${result.desc}`));
    } else if (!remoteOpts?.noRemote && TECH_TO_BRANCH[tech]) {
        // Default: load from remote HuggingFace dataset.
        const opts: RemoteLibSigsOptions = {
            signatureQuality: remoteOpts?.signatureQuality ?? 100,
            refreshCache: remoteOpts?.refreshCache ?? false,
            skipCacheChecks: remoteOpts?.skipCacheChecks ?? false,
        };
        const result = await loadRemoteLibSigs(tech, opts);
        if (result) {
            libSigs = result.sigs;
        } else {
            console.log(chalk.yellow(`[~] Remote signatures unavailable — proceeding without library stripping`));
        }
    }

    // iterate through the chunks
    if (tech === "next") {
        for (const [, value] of Object.entries(chunks)) {
            const moduleFiles = await refactorNext(value);
            for (const [moduleId, rawCode] of Object.entries(moduleFiles)) {
                const formatted = await prettier.format(rawCode, {
                    parser: "babel",
                    singleQuote: true,
                    trailingComma: "none",
                });
                fs.writeFileSync(`${outputDir}/${moduleId}.js`, formatted);
                console.log(chalk.green(`[✓] Module ${moduleId} written to ${outputDir}/${moduleId}.js`));
            }
        }
    } else if (tech === "react-webpack") {
        // Sort chunks so the main bundle (contains library module definitions) is processed
        // first.  Its libModuleMap is then available when processing lazy chunks that import
        // those same library module IDs (e.g. 540=React, 848=jsx-runtime, 671=react-router-dom).
        const sortedEntries = Object.entries(chunks).sort(([a], [b]) => {
            const aIsLazy = /^\d+_/.test(a);
            const bIsLazy = /^\d+_/.test(b);
            if (!aIsLazy && bIsLazy) return -1; // main bundle first
            if (aIsLazy && !bIsLazy) return 1;
            return 0;
        });

        // Accumulated library module map — grows as main bundles are processed.
        // Passed to each subsequent chunk so lazy chunks can rewrite library imports.
        const accLibModuleMap = new Map<string, LibraryModuleInfo>();

        // Pre-scan vendor chunks from the assets directory that are not in mapped.json.
        // These files (e.g. vendor-router.*.js, vendor-react-dom.*.js) contain library
        // modules whose export maps must be classified before processing application chunks.
        const assetsDir = findAssetsDir(chunks, mappedJson);
        if (assetsDir) {
            const vendorFiles = findVendorChunkFiles(chunks, assetsDir);
            for (const vendorFile of vendorFiles) {
                console.log(chalk.cyan(`[i] Pre-scanning vendor chunk: ${path.basename(vendorFile)}`));
                const vendorCode = fs.readFileSync(vendorFile, "utf8");
                const vendorChunk = {
                    id: path.basename(vendorFile, ".js"),
                    description: "",
                    loadedOn: [] as [],
                    containsFetch: false,
                    isAxiosLibrary: false,
                    exports: [] as string[],
                    callStack: [] as [],
                    code: vendorCode,
                    imports: [] as string[],
                    file: vendorFile,
                };
                const vendorResult = await refactorReact(vendorChunk, undefined, undefined, true);
                for (const [id, info] of vendorResult.libModuleMap) {
                    accLibModuleMap.set(id, info);
                    console.log(chalk.gray(`  [-] Vendor module ${id} → ${info.type} (${info.exportMap.size} exports)`));
                }
            }
        }

        const writtenFiles: string[] = [];
        for (const [, value] of sortedEntries) {
            const result: RefactorReactResult = await refactorReact(value, libSigs, accLibModuleMap);
            // Merge this chunk's library classifications into the accumulator.
            for (const [id, info] of result.libModuleMap) {
                accLibModuleMap.set(id, info);
            }
            for (const [moduleId, rawCode] of Object.entries(result.files)) {
                const formatted = await prettier.format(rawCode, {
                    parser: "babel",
                    singleQuote: true,
                    trailingComma: "none",
                });
                // Skip writing empty files (e.g. index.js after webpack runtime stripping).
                if (formatted.trim().length === 0) {
                    console.log(chalk.gray(`[~] Module ${moduleId} is empty after stripping — skipping`));
                    continue;
                }
                const filePath = `${outputDir}/${moduleId}.js`;
                fs.writeFileSync(filePath, formatted);
                writtenFiles.push(filePath);
                console.log(chalk.green(`[✓] Module ${moduleId} written to ${outputDir}/${moduleId}.js`));
            }
        }

        // Build check — scaffold a minimal Vite project and verify the refactored
        // code compiles.
        runBuildCheck(outputDir, writtenFiles);
    }

    console.log(chalk.green("[✓] Refactoring complete."));
};

export default refactor;
