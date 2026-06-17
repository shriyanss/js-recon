# `src/refactor/react` — webpack React bundle splitter

## Purpose

Splits a webpack 5 React bundle (the numeric module map `var e = { 540(e,n,t){…}, 287(e,n){…}, … }`) into individual ECMAScript module files, one per numeric module ID.

## File layout

| File                   | Responsibility                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`             | Entry point: parses the bundle AST, collects `ModuleEntry` objects, orchestrates the transform + validate loop, collects non-module IIFE content into `index.js`, returns `Record<moduleId, code>` |
| `transform.ts`         | `transformModule(mod)` — four-pass AST rewrite that converts one webpack module function into ES module statements; `transformIndexStatements` — eight-pass cleanup for the IIFE body              |
| `library-classify.ts`  | `classifyLibraryModule` — detects which library a module belongs to (react, react-dom-client, react-jsx-runtime) by scanning export assignments; `resolveReexportChains` — follows transparent re-export chains (e.g. 540→287/React) |
| `helpers.ts`           | Pure AST pattern matchers and export-builder utilities                                                                                                                                             |
| `validator.ts`         | `validateAndFix` — iterative Babel strict-parse → fix loop                                                                                                                                         |

## Webpack module shapes

Two param signatures appear in React webpack bundles:

| Shape   | Params                       | Meaning                                                              |
| ------- | ---------------------------- | -------------------------------------------------------------------- |
| 3-param | `(module, exports, require)` | Normal module — has require calls and may populate `exports`         |
| 2-param | `(module, exports)`          | Pure export module — no require; populates `exports.<prop>` directly |

The numeric key in the object literal is the module ID. Both `ObjectProperty` (arrow/function value) and `ObjectMethod` shorthand forms are captured.

## Transform passes (in `transform.ts`)

All passes iterate only over **top-level** `body.body` statements to avoid placing `export` declarations inside nested functions (which causes `export may only appear at top level`).

1. **Pass 1** — `<moduleParam>.exports = <rhs>`:
    - `<rhs>` is `<requireParam>(N)` → `export * from "./N.js"` (transparent named re-export)
    - anything else → `export default <rhs>`
    - Also handles the SequenceExpression case: `(e.exports = t(N), ...)` splits into individual statements

2. **Pass 2** — `<exportsParam>.<propName> = <rhs>` for all modules with an exportsParam:
    - `FunctionExpression` → `export function propName(…) { … }`
    - `Identifier` → `export { ident as propName }` (string key when propName isn't a valid JS identifier)
    - Everything else → `export const propName = <rhs>`
    - Handles both direct assignment and SequenceExpression (`(n.a = 1, n.b = 2, …)`)

3. **Pass 3** — Hoist `var x = <requireParam>(N)` to `import * as x from "./N.js"` (removes the declarator, records the mapping)

4. **Pass 4** — Remaining inline `<requireParam>(N)` calls replaced with the hoisted identifier (or a synthesized `_jsr_module_N` if not yet seen)

5. **Step 5** — Strip the outer function wrapper: prepend `import *` statements, return `[...importStmts, ...body.body]`

## Validator (in `validator.ts`)

`validateAndFix(statements, moduleId)` runs up to `MAX_FIX_ITERATIONS` (10) rounds:

1. Generate code from statements
2. Strict-parse with Babel (`errorRecovery: false`) — if no errors, return
3. Re-parse with `errorRecovery: true` to locate errored nodes, then downgrade or drop:
    - `export { ident as "StringKey" }` → `export const StringKey = ident`
    - `export function name() {}` → `export const name = function() {}`
    - Anything else → dropped with a yellow warning

If still failing after 10 attempts, the module is skipped (not written).

## Helpers (in `helpers.ts`)

- `isInModuleMap(path)` — confirms an ObjectProperty/ObjectMethod's grandparent is a VariableDeclarator or AssignmentExpression (i.e. the top-level webpack module map, not a nested object)
- `tryExtractExportsAssignment` / `tryExtractModuleExportsAssignment` / `tryExtractRequireCall` — pattern matchers returning structured data or null
- `buildModuleExportStatement` / `makeNamedExportStatement` — AST builders for valid ECMAScript export forms

## `index.js` — non-module IIFE content

Webpack main bundles wrap everything in an IIFE (`(() => { … })()`). Inside that IIFE, the module map variable (e.g. `var e = { 540: fn, … }`) is the only thing split into per-module files. Everything else — webpack require helpers, app component functions, the `ReactDOM.render(…)` entrypoint call — lives in that same IIFE body but outside the module object.

`refactorReact` captures this content, passes it through `transformIndexStatements`, and writes the result to the `"index"` key of the returned record (→ `output_refactored/index.js`).

### Collection helpers (in `index.ts`)

- `findIifeBody(program)` — finds the first top-level IIFE (zero-argument call of an arrow/function expression) and returns its `body.body` statements. Returns `null` if no IIFE is present; the program body is used as fallback.
- `isModuleMapDeclarator(d)` — returns `true` when a `VariableDeclarator`'s `init` is a non-empty `ObjectExpression` where every property has a `NumericLiteral` key and a function value. Used to skip the module-map declarator when building `index.js`.
- Multi-declarator `var` statements (e.g. `var e = { modules }, n = {}`) are split: the module-map declarator is dropped, the remaining declarators are re-emitted as a new `VariableDeclaration`.

### `transformIndexStatements` (in `transform.ts`)

Cleans up webpack-internal artifacts with 8 passes. Passes A–C always run; D–H only when `libModuleMap` is provided (i.e. with `--collisions`).

**Pass A** — Removes the webpack require helper function. Detection: `FunctionDeclaration` with 1 param whose body contains `return (moduleMap[id](mod, mod.exports, fn), mod.exports)`. The helper name (e.g. `"t"`) is recorded for B and C.

**Pass B** — Hoists `var x = requireFn(N)` to `import * as x from "./N.js"`. Also records `localVarName → numericModuleId` in `varToModuleId` for Pass D.

**Pass C** — Replaces remaining `requireFn(N)` calls anywhere in the tree.

**Pass D** — Library-aware import rewriting (only with `--collisions`). Builds `varName → LibraryModuleInfo` from `varToModuleId` and the library identity map, then:
- Traverses all statements and rewrites `(0, varName.prop)(args)` → `canonicalName(args)` where the canonical name is determined from `LibraryModuleInfo.exportMap` (e.g. `l.H` → `createRoot`) or by recognising the prop as an already-canonical name (e.g. `r.useState` → `useState`).
- Replaces namespace imports with named imports from the actual library path (`import { useState } from 'react'`, `import { createRoot } from 'react-dom/client'`).

**Pass E** — Collapses Babel's `slicedToArray` inline expansion. Detects `var e, n, t = ((e = actualCall), (n = count), ...TypeError-throwing-IIFE...), l = t[0], u = t[1]` (the compiled form of `const [l, u] = actualCall`) and rewrites it to `const [l, u] = actualCall`. Applied at every depth via `collapseSlicedToArrayDeep`.

**Pass F** — JSX recovery. Traverses looking for `jsx(tag, props)` / `jsxs(tag, props)` / `jsxDEV(tag, props)` calls (bare identifier callee — these are only bare after Pass D rewrites them) and replaces them with `JSXElement` nodes. Handles: string/identifier tags, props as JSXAttributes, `children` array → individual JSXChildren, string literals → JSXText, everything else → `JSXExpressionContainer`.

**Pass G** — Removes:
- Babel `arrayLikeToArray` helper functions (detected by shape: 2–4 statement body containing a `for` loop that initialises `Array(n)`).
- `var x = {}` declarations where all declarators have empty object inits (webpack module-cache variable).

**Pass H** — Prunes named import specifiers whose local name is not referenced in the body statements. Mainly catches `jsx`/`jsxs` imports that become stale after JSX recovery converts them to JSX syntax.

## `--collisions <file>` — CS-MAST library module stripping

When `refactor -t react-webpack` is invoked with `--collisions <file>`, every captured webpack module is classified as either *library code* (React / React-DOM / scheduler / `react/jsx-runtime` / etc.) or *application code* by matching its AST signature against a precomputed cross-app baseline. Library-flagged modules are dropped from the output, leaving just `index.js`.

### Where the baseline came from

The baseline is the output of the `js-recon-research/react/jsr-refactor/experiment/` pipeline. 18 minimal React apps — one per hook/API (`01-usestate-hook-webpack` through `18-forwardref-webpack`) — were each rebuilt 18 times with each of the *other* hooks injected. After every iteration, the 18 webpack bundles were hashed with `js-recon cs-mast --all-scat-permutations`, and signatures appearing in *all 18* bundles were emitted to `feature-signatures/<feature>/<scat-combo>/collisions.json`. Any of these files is a valid `--collisions` argument; they all encode the same baseline structure (React runtime), just under a different scat configuration.

The refactor pass uses scat = `lit,decl,loop,cond` internally, so the matching file is `feature-signatures/<any-feature>/lit-decl-loop-cond/collisions.json`. Choosing a different scat config would require changing `LIB_SIG_SCAT` in `index.ts` *and* pointing `--collisions` at the corresponding directory.

### Future-reference guide: how this feature was built

This subsection is intentionally exhaustive. If the feature regresses, decisions need re-evaluation, or the same approach gets applied to another framework (Next.js, Vue, Svelte), this guide is the source of truth.

#### 1. Problem statement

The default `refactor -t react-webpack` splits a webpack 5 bundle into one file per numeric module. For a "hello world + `useState`" app, that means ten files totalling ~240 KB on disk — nine of them are React internals (`react`, `react-dom`, `scheduler`, `react/jsx-runtime`), and **only one of them (`index.js`, ~2 KB)** is application code. A human reviewing the refactored output has to know to ignore the nine library files.

Goal: identify the library files automatically and drop them, so the refactor output is just the application code.

The naïve approach — hardcoding "module 540 is React, module 338 is react-dom/client, etc." — fails because webpack assigns numeric module IDs based on a hash of resolved paths. Different React versions, different webpack versions, different OS/CWD all change the IDs. We need a content-based identifier that survives minification and toolchain changes.

#### 2. Why CS-MAST signatures fit

CS-MAST-S (Context-Stratified Merkelized Abstract Syntax Tree, signatures variant) produces a content-derived SHA-256 hash for every AST node. The "scat" categories control *which* aspects of a node contribute to the hash. With `scat: ["lit","decl","loop","cond"]`:

- `lit` — literal **values** participate (numbers, strings, regex bodies)
- `decl` — declarations participate, but only their **shape** (kind, variant), not the bound names
- `loop` — loops participate, with child hashes sorted alphabetically (loop body ordering is canonicalised)
- `cond` — conditionals participate

Identifier *names* (`name`, `id`, `op_name`) are deliberately **excluded**. That is the crucial property: webpack/terser mangles `useState` into `u`, `useEffect` into `i`, etc., and a given local can be `e` in one bundle and `t` in another. A scat that ignored names lets the same React runtime hash identically across all bundles produced from the same source.

Operators are also excluded. We don't need them because the *structure* of the loops and conditions in the React runtime is what fingerprints it — the operator choices follow from that.

#### 3. Data needed to build a baseline

To classify modules as library-vs-not, we need a **set of bundles where the only shared content is the library code**, so a "signature shared by every bundle" can be reliably attributed to library code (the only thing all the bundles have in common).

Concretely, the data set must satisfy:

- **Toolchain consistency.** Every app uses the *same* React major, the *same* webpack major, the *same* `@babel/preset-env` target. A bundle from React 18 has different internals from React 17; mixing them would erode the count-equals-all-apps signal.
- **Application diversity.** Each app exercises a *different* React feature (one hook or API per app: `useState`, `useEffect`, `useRef`, `Suspense`, `forwardRef`, …). The application code in app N has no overlap with app M's application code, so any signature shared between them is necessarily library code.
- **Realistic bundling.** Apps are built with `webpack --mode=production`, served, and downloaded via Puppeteer (`js-recon lazyload`), so the file we hash is the same one a real user would scan.
- **Sufficient corpus size.** 18 apps was chosen as enough to cover the React 18 feature surface; fewer apps would risk an application-code signature accidentally colliding across the corpus.

The experiment that built the current baseline lives in `js-recon-research/react/jsr-refactor/experiment/`. Its `README.md` and `CLAUDE.md` document the run protocol; the relevant artefacts are:

- `features/<NN>-<feature>-webpack/` — one minimal React app per feature (~10-line `src/index.jsx`, identical `webpack.config.js`/`package.json` across all 18)
- `experiment/run-experiments.sh` — orchestration loop (inject → rebuild → serve → lazyload → cs-mast → revert)
- `refactor_observations/feature-signatures/<feature>/<scat-combo>/collisions.json` — output, one file per (iteration, scat-combo) pair

The reason there are 18 iterations × 511 scat combos = 9198 files: the experiment doesn't pre-pick a scat config. It produces every non-empty subset of the 9 scat categories so the analysis can choose whichever subset gives the cleanest signal. The refactor consumes `lit-decl-loop-cond` (see Decision 5.b below).

#### 4. Why "count equals all apps" defines library

Inside each `collisions.json`, every record has a `count` field — the number of bundles in the corpus that produced that signature. `count == 18` (i.e., `count == maxCount` in the file) means the signature appears in *every* bundle. Since every app's application code is unique, the only way for a signature to appear in all 18 bundles is for it to come from code those bundles share — the library.

The implementation in `src/refactor/index.ts` doesn't hardcode 18; it computes the maximum count from the file (`records.reduce((m, r) => …)`). This way the same code works for a baseline with N apps for any N, and the threshold automatically scales.

#### 5. Algorithmic decisions and tradeoffs

##### 5.a — Threshold: max count vs absolute majority

Using `count >= maxCount` is strict: a signature is library only if it appears in *every* bundle. A relaxed threshold (e.g. `>= 0.9 * N`) would catch signatures shared by most-but-not-all bundles (e.g. a polyfill present in 17 of 18 apps), but introduces false positives: rare application-code patterns that happen to recur in 17 unrelated apps would be falsely flagged.

We chose the strict variant. The cost is missing a small number of library patterns (acceptable — see 5.c below); the benefit is zero false-positive risk on application code. For the 01-usestate test bundle, this still matches all 9 modules.

##### 5.b — Scat choice: `lit-decl-loop-cond`

This subset was picked after testing several configurations against the local 01-usestate bundle (a one-off `find-usestate-sig.mjs` script on the experiment host):

| Scat                       | count=18 sigs (remote) | Sigs found in local | Notes                                  |
| -------------------------- | ---------------------- | ------------------- | -------------------------------------- |
| `lit`                      | 4                      | 4/4                 | Too narrow — only matches 4 literals   |
| `decl`                     | 561                    | 561/561             | Good, but misses literal-driven shape  |
| `cond`                     | 673                    | 673/673             | Good, but no decl/loop structure       |
| `decl-cond`                | 1219                   | 1219/1219           | Strong                                 |
| `lit-decl-cond`            | 1223                   | 1223/1223           | Strong                                 |
| **`lit-decl-loop-cond`**   | **1232**               | **1232/1232**       | **Chosen — best coverage**             |
| `lit-decl-loop-cond-val-op_name` | 2200             | …                   | Bigger but no extra useful coverage    |

`lit-decl-loop-cond` matched **1232 of 1232** baseline-shared signatures in the local bundle — i.e. every signature the experiment said was library code is indeed present in the bundle being refactored. That gives the highest possible confidence in classification.

Adding `name`/`id`/`op_name` reduces the count=all-apps set because identifier names *differ* across bundles (minifier picks different short names per bundle), so signatures involving names rarely collide across all 18. That doesn't *break* the algorithm but provides no extra coverage.

##### 5.c — Sub-tree match, not root match

`moduleIsLibrary()` iterates `tree._signatureMap.keys()` — every *actively-hashed sub-tree* in the module body — and matches each against the library set. A single match flags the whole module.

Root-only matching would miss many cases because the module body's root hash includes everything (function declarations, helpers, the require helper boilerplate around them). Tiny per-bundle variations (e.g. terser choosing slightly different inlining) change the root hash but leave most internal sub-trees identical. Sub-tree matching is robust to those variations.

The downside: any module that happens to contain a library-looking sub-tree gets flagged. For the test app that didn't happen (application code is in `index.js`, not in a numbered module), but if it ever does, the fallback is to require N≥2 matches or to escalate to a threshold-on-the-fraction-of-matched-sub-trees check. Both are easy to add to `moduleIsLibrary()` if needed.

##### 5.d — What gets hashed and how

The classifier hashes the module's `BlockStatement` body (not the whole `(module, exports, require) => {…}` function). The reason: the outer function wrapper is *identical* across all webpack modules in all bundles — always the same signature `(e, n, t) => {…}`. Including it would add noise (a baseline signature for the wrapper would match *every* module trivially). Hashing the body in isolation gives the cleanest signal.

```javascript
const body = (fnNode as { body: t.BlockStatement }).body;
const code = generate(body).code;        // re-serialise body in isolation
const tree = cs_mast_init(code, { scat: LIB_SIG_SCAT, … });
```

Re-serialising via `@babel/generator` is necessary because `cs_mast_init` parses source text, not Babel AST objects. The round-trip is lossy in formatting (whitespace, comments) but preserves the structure, which is all the scat config cares about.

##### 5.e — What we strip vs what we keep

The classifier only decides "library or not". The actual stripping happens earlier in `refactorReact()`: a library-flagged module is logged (`[-] Module N matches library baseline — skipping`) and the loop `continue`s, so the module never reaches `transformModule()`/`validateAndFix()` and no file is written.

The collected non-module IIFE content (the `index.js` payload — webpack bootstrap, app components, render call) is still emitted in full. We don't try to classify *inside* `index.js`; the assumption is that everything outside the numeric module map is application code, and the test corpus confirms that.

#### 6. Verification protocol

Three layers of validation, in order:

1. **Coverage check.** Re-hash a bundle from the same toolchain as the baseline; verify the count=all-apps signatures from the baseline are present in the bundle's signature map. For the 01-usestate fresh-rebuild bundle, this gave 1232/1232 with `lit-decl-loop-cond`. If this number drops noticeably, the baseline and the bundle are no longer apples-to-apples (toolchain drift).

2. **Module-by-module classification.** Run `refactor -t react-webpack --collisions <baseline>` against the bundle. Check the log: every React/scheduler/jsx-runtime module should be skipped. For 01-usestate, all 9 modules (551, 338, 961, 20, 287, 540, 848, 463, 982) were skipped on first run.

3. **Parity with prototype.** Before this feature landed in the tool, the algorithm was first implemented as a standalone script (`/root/jsr-analysis/refactor-v3.mjs` on the experiment host). The tool's `index.js` output must match the standalone output byte-for-byte (modulo Prettier formatting). Diff them whenever the algorithm changes.

#### 7. Reproducing or extending the baseline

To rebuild the React-webpack baseline (e.g. for a new React major version):

1. Update `js-recon-research/react/jsr-refactor/features/*/package.json` to the target versions, run `npm install` everywhere.
2. Run the experiment: `bash js-recon-research/react/jsr-refactor/experiment/launch-parallel.sh --instances 3`. Documented in `experiment/CLAUDE.md`; expect ~6.5 hours on the experiment host.
3. Copy `refactor_observations/feature-signatures/<any-feature>/lit-decl-loop-cond/collisions.json` into `js-recon-cs-mast-s/baselines/react-webpack/lit-decl-loop-cond/collisions.json`.

To add a baseline for a new framework (e.g. Next.js, Vue, Svelte):

1. Build a parallel experiment in `js-recon-research/<framework>/` with N minimal apps that exercise different features of the framework.
2. Pick a scat config: start with `lit-decl-loop-cond`, validate coverage against a real bundle; iterate if needed.
3. Add an entry to `BASELINE_SCAT_DIR` in `src/refactor/index.ts` so the resolver knows where to look.
4. Add a tech-specific `moduleIsLibrary()`-equivalent in `src/refactor/<framework>/index.ts`. The Next.js and Vue refactor passes have different module-shape detection, so the classifier needs to know what "a module" is for that framework.

#### 8. Known limitations and likely failure modes

- **Library naming is not recovered.** The classifier says "module N is library" but not which library. `index.js` still emits `import * as r from "./540.js"` instead of `import { useState } from "react"`. To recover names we'd need *per-library* baselines (one collisions file for each of `react`, `react-dom/client`, `react/jsx-runtime`, `scheduler`) and a "which library's baseline matches this module?" classifier. Not implemented yet.
- **Toolchain drift erodes coverage.** A baseline produced from React 18.3.1 + webpack 5.107 + babel preset-env "default" target will not classify a React 17 bundle as cleanly. Pin the baseline source toolchain to whatever your target bundles use.
- **CDN'd library polyfills.** A baseline app that includes a polyfill not present in production targets (e.g. `core-js` shimming) will have polyfill signatures in the count=all-apps set. Those signatures will match the same patterns in target bundles even when the target intentionally retained them. This will rarely affect *modules* (polyfills usually live alongside React internals in the same chunks) but is worth knowing.
- **Vite/Rollup bundles.** Those don't use the numeric module-map pattern at all; the feature is a no-op because there are no modules to classify. The default `react-webpack` refactor already fails gracefully for those (zero modules found, just emits `index.js`).

## Gotchas

- **Top-level only.** Never use `fnPath.traverse()` for Passes 1 and 2 — it recurses into nested functions and emits `export` inside them.
- **`export * from` does not re-export default.** If the target module has a default export, callers must use `import defaultVal from "./N.js"` separately.
- **Vite/Rollup bundles.** These don't use the numeric-keyed module map pattern; `isInModuleMap` will find nothing and 0 modules will be processed. That's expected.
- **String-keyed exports.** `export { x as "prop-name" }` is ES2022. The validator's downgrade step handles parsers that don't support it.
- **`index.js` is plain JS in module mode.** `validateAndFix` uses `sourceType: "module"` but the `index.js` statements contain no imports/exports — they are regular JS declarations and expression statements, which are valid in module context.
