# `src/refactor` — deobfuscation / readability pass

## Purpose

Optional pass that rewrites minified chunks into a more readable form for human review. Now wired into the `run` pipeline via `src/run/bundler-detect.ts` (CS-MAST-S bundler detection); can also be invoked manually after `lazyload` when a contributor wants to inspect specific chunks during resolver development.

## Files

- `index.ts` — entrypoint. Dispatches by tech (`next-turbopack`, `react-webpack`, `react-vite`). Also contains `loadRemoteLibSigs()`, which fetches and intersects `collisions.json` files from the HuggingFace dataset by default.
- `remote/hf-client.ts` — all HuggingFace bucket interaction isolated in one place. Contains `TECH_TO_BRANCH` mapping, URL builders, `fetchText()`, `listCollisionsFiles()`, `fetchCollisionsJson()`, `validateRemoteBranch()`, `validateRemotePath()`, `getSampleSize()`, `getTechnology()`.
- `remote/config.ts` — reads/writes `~/.js-recon/refactor/config.json` (currently only `maxCacheSizeMb`, default 512 MB). Creates the config dir and a default config if missing.
- `remote/cache.ts` — manages two cache layers: (1) the file list cache (`~/.js-recon/refactor/cs-mast-s-list-cache.json`, refreshed every 7 days or on `--refresh-cache`); (2) per-file signature cache (`~/.js-recon/refactor/signature_cache/<branch>/<subpath>/collisions.json` + `cached_at.txt`). Eviction runs whenever a new file is saved and the cache dir exceeds `maxCacheSizeMb` — oldest entries are deleted until the dir is below 50% of the limit.
- `react-vite/index.ts` — Vite React refactor implementation. Analyzes vendor chunks (`vendor-react-*.js`) to build library export maps, classifies CJS interop vars (`var x = __toESM(getter(), 1)` or bare `var x = getter()`), rewrites `(0, x.prop)(args)` calls to bare canonical names, rewrites vendor import statements to canonical library imports, then runs shared cleanup passes (E/F/G/H from `react/transform.ts`). After writing output files, runs a Vite build check to validate the refactored JSX compiles correctly. Accepts `libSigs` and `scatOverride` parameters; when `libSigs` is non-empty, each non-vendor chunk is classified using CS-MAST (`fileIsLibrary()`) before transformation — file-level equivalent of webpack's module-level `moduleIsLibrary()`. Dataset: `react/vite/large-0.1.8` (36-app cross-injection, cs-mast v0.1.8).
- `react-vite/vendor-analyze.ts` — `analyzeVendorChunk(code)` parses a Vite vendor chunk and returns a `Map<exportedName, VendorExportInfo>` classifying each export as React/jsx-runtime/react-dom/react-router-dom.
- `next/index.ts` — Next.js (Turbopack) refactor implementation (`-t next-turbopack`). Handles both turbopack 3-param `func_NNN = (runtime, module, exports) => {...}` modules and 1-param `func_NNN = (runtime) => {...}` modules, plus webpack-style `(module, exports, require) => {...}`. Param mapping for turbopack: params[0]=runtime (`e.r(N)`/`e.i(N)` for requires, `e.s([name,0,fn])` for 1-param exports), params[1]=module (`t.exports=...` interop), params[2]=exports (ODP target). Export forms: ODP(r,"name",{get:fn}), for-in export loop, IIFE batch, runtime.s([]), webpack require.d. Applies passes E (slicedToArray), F (JSX recovery on body + export stmts), G (Babel helpers), H (prune unused imports).
- `react/index.ts` — React refactor implementation. Detects each webpack module function under `var e = { <numericId>: function(module, exports, require) { ... } }` (and 2-param re-export modules `function(module, exports) { module.exports = require(N) }`), rewrites `require(<n>)` to `require("./<n>.js")`, captures exports via `Object.defineProperty(<exports>, ...)`, `<require>.d(<exports>, { ... })`, and `<exports>.<minProp> = <X>.<canonical>` assignments. Classifies modules by content fingerprint (`react` via `<X>.current.<hook>(...)` call shape; `react/jsx-runtime` via exports of both `jsx` and `jsxs`; `react-dom/client` via export of `createRoot`); resolves re-export chains. Rewrites bundled user-code callsites documented in `refactor_observations/00-bundled-shape-shared.md`:
    - `(0, <reactLocal>.<hook>)(args)` → `<hook>(args)` + `import { <hook> } from "react";`
    - `(0, <jsxLocal>.jsx)(args)` → `jsx(args)` + `import { jsx, jsxs, Fragment } from "react/jsx-runtime";`
    - `<reactDomLocal>.<minProp>(args)` → `createRoot(args)` using the module's export map.
      Any unrecognised `(0, X.Y)(args)` is still flattened to `X.Y(args)`. Outputs the import lines at the top of the chunk file.
    - In addition to the per-module numeric files, all IIFE body statements that are NOT part of the module map (helpers, app component functions, the `ReactDOM.render(…)` entrypoint) are collected, transformed, and written to `index.js`.
    - The webpack require helper function (detected by its `return (moduleMap[id](...), mod.exports)` return shape) is stripped from `index.js`.
    - Top-level `var x = requireFn(N)` calls in `index.js` are hoisted to `import * as x from "./N.js"`; any remaining inline `requireFn(N)` calls inside nested functions are replaced with the imported identifier.
    - **Pass 4.5**: webpack async chunk loading `requireParam.e(N).then(requireParam.bind(requireParam, N))` is converted to `import('./N.js')` (applied in `transformModule` before stripping the wrapper, only when `requireParam` is known).
    - **`renameRouteComponents`**: after Pass D resolves `lazy` as a bare identifier, this pass traverses the JSX `<Routes>` tree, accumulates path segments, and renames minified lazy-component variables to descriptive PascalCase names (e.g. `/admin/users` → `AdminUsers`). The Suspense fallback becomes `Loading`, the root App function becomes `App`.

## Patterns / gotchas

- **Per-tech subdirs.** Each tech keeps its own AST pass under `<tech>/`; do NOT merge them. Webpack module wrappers are shared in shape, but each framework adds extras (Next.js runtime helpers, React refresh runtime, …).
- **Prettier is required.** Without formatting, the AST-normalized output is harder to read than the original minified code. Don't make Prettier optional.
- **Output goes to a sibling dir** (e.g. `output/<host>/static/js-refactored/`) — never overwrite the source chunks, downstream steps (`map`, `analyze`) still need them.
- **Lossy.** Identifier renaming can produce collisions; the exports walk can collapse multi-getter shapes; refactored code is for human inspection only, never feed it back into `map`.
- **Duplicate default export guard.** Webpack 5 / Vite bundles parsed with `sourceType: "unambiguous"` may already contain `export { X as default }` or `export default X` as real ESM statements in the source. The trailing-export logic in `react/index.ts` checks `codeHasDefaultExport` (a regex over the generated code) before appending another `export default`; omitting this check causes a `SyntaxError: Only one default export allowed per module` from Prettier.

## How to test changes here

```bash
npx tsc && node build/index.js refactor -m output/<host>/mapped.json -t <next-turbopack|react-webpack|react-vite> -o /tmp/refactored
```

For `react-vite`, the build check runs automatically after writing files — a passing `[✓] Vite build check passed` line confirms the output compiles. Spot-check individual files by hand for JSX correctness and correct import names.

## `--collisions <file>` (library module stripping)

Library module stripping now has **two sources** for signatures, checked in priority order:

1. **`--collisions <local-path>`** (explicit override) — unchanged from before; accepts a file, standard directory, or per-feature results directory. See the three cases in `buildLibSigs()`.
2. **Remote HuggingFace bucket** (default) — when `--collisions` is absent and `--no-remote` is not set, `loadRemoteLibSigs()` in `index.ts` fetches `collisions.json` files from `https://huggingface.co/buckets/shriyanss/cs-mast-s-dataset` on the bucket prefix mapped by `TECH_TO_BRANCH` (e.g. `react-webpack` → `react/webpack/small`). Files are cached locally under `~/.js-recon/refactor/signature_cache/`.

The refactor command also accepts the legacy `--collisions <file>` argument. When provided, it points at a CS-MAST `collisions.json` file produced by `cs-mast --all-scat-permutations` over a cross-app baseline (the `js-recon-research` 18-React-feature experiment). Modules whose body signature is in the baseline set are treated as library code and skipped during refactor.

**`--remote-collisions <path>`** accepts an explicit HuggingFace bucket path (e.g. `react/vite/large-0.1.8`) and uses it as the signature source instead of the automatic `TECH_TO_BRANCH` mapping. When provided, the path is validated with `validateRemotePath()` (checks that the bucket tree API returns at least one entry); if the path does not exist, the tool exits with code 25. Feature directories that return 0 collision records are silently skipped during intersection rather than collapsing the result to zero — this handles sparse datasets where some feature apps produced no cross-app signatures at the chosen scat combination.

**`--scat <categories>`** overrides the CS-MAST scat category set used for both the remote signature download (bucket directory name resolution) and the module classifier (`LIB_SIG_SCAT` in `react/index.ts`). The value is a comma-separated list of categories from `ALL_SCAT_CATEGORIES = ["lit","id","op","decl","loop","cond","name","val","op_name"]`. The `scatToDir()` helper in `index.ts` maps the user-supplied list to the canonical bucket directory name by filtering `ALL_SCAT_CATEGORIES` in order (so `--scat cond,lit` → `"lit-cond"`, matching jsr-cs-mast-s-gen's naming convention).

**Pipeline in this directory:**

1. `index.ts` accepts a file path, a standard baseline-tree directory, or a per-feature results directory for `--collisions`. `buildLibSigs()` handles three cases and returns `{ sigs: Set<string>; desc: string } | null` directly (the caller no longer loads the file itself):
    - **Case 1 — direct file path**: reads the file, keeps records whose `count` equals the maximum count, and returns that `Set<string>`.
    - **Case 2 — standard directory**: walks the four directory candidates in order (`<dir>/baselines/<tech>/<scat>/collisions.json`, `<dir>/<tech>/<scat>/collisions.json`, `<dir>/<scat>/collisions.json`, `<dir>/collisions.json`) until a file is found, then applies the max-count filter. The `<scat>` segment comes from `BASELINE_SCAT_DIR[tech]` — keep that map in sync with each tech's `LIB_SIG_SCAT` constant.
    - **Case 3 — per-feature results directory**: detects `<dir>/<feature>/<scat>/collisions.json` by scanning immediate subdirectories, then **intersects** the max-count signature sets across all feature subdirs. Only one file per feature subdir is read (e.g. 18 files for 18 features). A signature that survives intersection appears in every feature's max-count set and is definitionally library code.

    The resulting `Set<string>` of library signatures is passed down to `refactorReact()` / `refactorNext()` as the `libSigs` argument.

2. `react/index.ts`'s `moduleIsLibrary()` re-hashes each module's body with `cs_mast_init({ scat: ["lit","decl","loop","cond"] })` and looks every sub-tree signature up in `libSigs`. If any matches, the module is dropped.
3. The default `lit-decl-loop-cond` scat config matches the directory name used in the research experiment's output tree (`feature-signatures/<feature>/lit-decl-loop-cond/collisions.json`). Changing the scat list here means consumers must change which `collisions.json` they pass.

See `react/CLAUDE.md` for the full build history and signature-matching rationale. The user-facing docs are at `js-recon-docs/docs/docs/modules/refactor/react-webpack.md` under "Library module stripping (with `--collisions`)".

## `--detect-version` (react-webpack, react-vite)

`--detect-version` uses CS-MAST-S reliable signatures to identify the exact React version bundled in the target app and applies that version to `react`/`react-dom` pins in the refactored output's `package.json`.

**New flags (added with multi-config support):**

- `--detect-version-config <config>` — `"dynamic"` (default) or comma-separated scat categories (e.g. `lit,decl,loop,cond`). Static configs are validated against all versions; exits with code 26 if any version has an empty `reliable_signatures.json`.
- `--detect-version-dynamic-threshold <n>` — max scat configs to select in dynamic mode (default: 3).
- `--detect-version-dynamic-conf-purge` — purge the cached dynamic config and recompute.

**Implementation:** `src/refactor/remote/version-detect.ts` + glue in `src/refactor/index.ts`

Key functions:

- `listAvailableVersions(bundler)` — lists version dirs under `version/react/<bundler>/` in the HF bucket (exported).
- `listScatDirsForVersion(bundler, version)` — lists scat config dirs under `version/react/<bundler>/<version>/`.
- `selectDynamicScatConfigs(bundler, versions, threshold)` — iterates scat dirs, picks the first `threshold` that have non-empty `reliable_signatures.json` for ALL versions.
- `validateStaticScatConfig(bundler, versions, scatDir)` — returns false if any version has empty sigs for the given scatDir.
- `generateBundleSignatures(chunks, scat, extraCodes?)` — runs `cs_mast_init` on every chunk + optional extra code snippets.
- `fetchReliableSignatures(bundler, version, scatDir)` — downloads `version/react/<bundler>/<version>/<scatDir>/reliable_signatures.json`, caches locally with a 7-day TTL.
- `detectReactVersion(chunks, tech, scatDirs, extraCodes?)` — for each scat dir, generates bundle sigs and counts reliable-sig matches per version. Sums match counts across all scat dirs; returns the version with the highest total.

Scat config resolution is handled by `resolveVersionDetectionScatDirs()` in `index.ts`, which reads/writes the cache in `~/.js-recon/refactor/config.json` (`dynamicVersionDetectionScatConfig` field).

**Data source:** `shriyanss/cs-mast-s-dataset` HF bucket under `version/react/<bundler>/`. Generated by `jsr-cs-mast-s-gen-react-version` with `@shriyanss/cs-mast` v0.1.8. Requires js-recon to use cs-mast ≥0.1.8 for signatures to match.

**Coverage:**

- webpack: react-0.12 through react-19 (8 versions)
- vite: react-16 through react-19 (4 versions)

## See also

- `../map/next_js/` — the place that benefits from refactored chunks during resolver development.
