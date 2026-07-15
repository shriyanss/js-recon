# `src/refactor/next` — Next.js refactor (`-t next-turbopack` / `-t next-webpack`)

## Purpose

Rewrites Next.js bundle chunks into readable ECMAScript module files during manual
resolver development. Handles both the native turbopack module format and the webpack-style
modules that coexist in a turbopack bundle, as well as standalone Next.js webpack builds.

## CS-MAST library stripping (`next-webpack`)

`refactorNextWebpack()` accepts optional `libSigs: Set<string>` and `scatOverride: ScatCategory[]` parameters. When `libSigs` is provided (loaded from the remote HuggingFace bucket `next/webpack/large-0.1.8` or a local `--collisions` path), each captured module is classified before transformation:

1. The module's function body is serialised with `@babel/generator`.
2. `cs_mast_init()` hashes the body with scat = `["lit","decl","loop","cond"]` (or `scatOverride`).
3. The fraction of sub-tree signatures that match `libSigs` is computed.
4. If `fraction >= 0.51` (`LIB_CLASSIFICATION_THRESHOLD`), the module is flagged as library/framework code, logged with `[-] Module N matches library baseline`, and skipped.

The `moduleIsLibrary()` helper in `index.ts` implements this logic. It is intentionally shared-by-copy with `src/refactor/react/index.ts` rather than extracted to a shared module, because the Next.js and React paths may diverge in future (e.g., different thresholds or hash configs per framework).

The `BASELINE_SCAT_DIR["next-webpack"]` entry in `src/refactor/index.ts` is `"lit-decl-loop-cond"`, matching the bucket directory name. The remote branch is `"next/webpack/large-0.1.8"` (added to `TECH_TO_BRANCH` in `hf-client.ts`).

## Module format in `mapped.json`

Both webpack and turbopack Next.js builds produce chunks in `func_NNN = (e, t, r) => {...}` format in `mapped.json`. The outer assignment expression is an `AssignmentExpression`. The `refactorNextWebpack` visitor accepts `AssignmentExpression | ExpressionStatement | Program` as valid parent nodes for the captured arrow function.

**Wrapper form varies by webpack/SWC version.** `getWebpackConnections.ts` synthesizes the chunk wrapper differently depending on whether the _original_ bundle module was an arrow function or a `function` expression:

- Arrow-form original → `func_<chunk.id> = (e, t, r) => {...}` (an `AssignmentExpression`).
- `function`-form original → `function webpack_<chunk.id> (e, t, r) {...}` (a named `FunctionDeclaration`).

Real-world Next.js webpack builds observed in practice are consistently the `function`-form — `docs/research/refactor/vue-refactor-study.md` documents the same pattern for Vue (webpack 4 → `FunctionExpression`, webpack 5 → `ArrowFunctionExpression`). `refactorNextWebpack()`'s traversal in `index.ts` therefore registers **two** visitor branches: a `FunctionDeclaration` branch that matches the synthesized `webpack_<chunk.id>` name directly (robust because `chunk.id` is already known — no generic "any top-level function" heuristic needed), and the original `ArrowFunctionExpression` branch. Both branches call a shared `isGenuineTopLevel()` check (`path.getStatementParent()?.parentPath?.isProgram()`) rather than only inspecting the node's immediate parent — this is required because a naive immediate-parent check (`parent?.isAssignmentExpression()`) also matches deeply nested arrows (e.g. an effect cleanup `n = () => { e(); }` buried inside the real module body), which previously caused a false-positive "recovered" 1–3 line garbage fragment whenever the real wrapper was invisible to the visitor (the `FunctionDeclaration` case, before this branch existed).

## Module formats

### 1. Turbopack 3-param format (`func_NNN = (runtime, module, exports) => { ... }`)

The dominant format (190/194 chunks in a typical Next.js turbopack build). The params map as:

| Position  | Role    | Usage                                                                |
| --------- | ------- | -------------------------------------------------------------------- |
| params[0] | runtime | turbopack runtime — `runtime.r(N)` / `runtime.i(N)` for imports      |
| params[1] | module  | module object — `module.exports = ...` for CJS interop boilerplate   |
| params[2] | exports | exports target — `ODP(exports,"name",{get:fn})` / for-in export loop |

**Critical note**: The runtime param (params[0]) is NOT the module and params[2] is exports,
NOT require. Requires are `runtime.r(N)` (MemberExpression), not `runtime(N)` (direct call).

### 2. Turbopack 1-param format (`func_NNN = (runtime) => { ... }`)

Used for page component chunks (~4 chunks per bundle). The single param is the turbopack
module context:

- `runtime.i(N)` → interop import (converted to `import * as name from './N.js'`)
- `runtime.s(["default", 0, fn])` → default export (converted to `export default fn`)

### 3. Webpack-style format (`(module, exports, require) => { ... }`)

Chunks whose code is the module function directly (no `func_NNN=` prefix). Unlike turbopack
3-param, this uses `require.d(exports, {...})` for export registration and `require.r(exports)`
as the ES module marker. Rare in pure turbopack builds.

## Transform passes

### Pass 1 — export collection + cleanup

Recognises three export forms:

- `Object.defineProperty(exports, "name", { get: () => localVar })` (direct ODP)
- `!(function(target, map) { for(r in map) ODP(target, r, ...) })(exports, { name: fn, ... })` (turbopack IIFE batch)
- `require.d(exports, { name: () => localVar, ... })` (webpack-style)

Also drops:

- `Object.defineProperty(exports, "__esModule", ...)` — interop marker
- `require.r(exports)` — webpack ES-module marker
- `module.exports = exports.default` — CJS interop boilerplate
- `"use strict"` expression statements

Side-effect requires inside sequence expressions (`(ODP, r(55824), r(67647))`) are turned into
`import "./N.js"` side-effect import declarations.

### Pass 2 — require hoisting

`var x = require(N)` declarators are removed from the body and replaced with
`import * as x from "./N.js"` at the top.

### Pass 3 — inline require replacement

Remaining `require(N)` call-sites anywhere in the function body are replaced with the hoisted
identifier (or a synthesised `_jsr_module_N` if not yet seen, which also produces a new import).

### Pass E — slicedToArray collapse

Babel's compiled `const [a, b] = expr` expansion (a multi-declarator `var` with a TypeError
IIFE) is collapsed back to a clean array destructure.

### Pass F — JSX recovery

`jsx(tag, props)` / `jsxs(tag, props)` / `jsxDEV(tag, props)` calls are converted to JSX
element nodes. Handles string/identifier tags, props as JSXAttributes, `children` array, and
nested jsx calls.

### Pass G — Babel helper removal

Strips top-level function declarations that are Babel runtime helpers: `_typeof`,
`_defineProperty`, `_arrayLikeToArray`, `_slicedToArray`, `_objectSpread2`, etc.

### Pass H — prune unused named imports

After JSX recovery the `jsx`/`jsxs` import specifiers often become stale — Pass H removes any
named import specifier whose local name has no reference in the body.

## Files

| File           | Responsibility                                                              |
| -------------- | --------------------------------------------------------------------------- |
| `index.ts`     | Entry: detects format, extracts params, calls transform, validates output   |
| `transform.ts` | All AST passes (1, 2, 3, E, F, G, H) for both turbopack and webpack modules |
| `helpers.ts`   | Pure AST pattern matchers and export/import builders                        |
| `validator.ts` | `validateAndFix` — iterative Babel strict-parse → downgrade/drop loop       |

## Gotchas

- **Re-export shims** (`func_NNN = (e, t, r) => { t.exports = e.r(M) }`) — these modules
  re-export another module via CJS interop. `isInteropBoilerplate` strips `t.exports = ...`
  and the body becomes empty — the module is skipped. Correct behaviour; the caller imports
  from M directly.

- **Side-effect sequence**: `(ODP(r,"__esModule",…), e.r(N1), e.r(N2))` — the ODP is dropped
  and each `e.r(N)` becomes a side-effect import. If `e.r(N)` was also hoisted (from a
  declarator earlier in the file), the side-effect import is suppressed to avoid duplicates.

- **Inner-scope exports**: Some ODP exports capture getter return values that are inner-scope
  variables (not top-level). These produce "Export 'X' is not defined" parse errors; the
  validator drops the specific `export { X as name }` statement and keeps the rest of the module.

- **1-param modules** have no `exportsParam` or `requireParam` — only the runtime param. Pass 1
  uses `runtimeParam.s([])` to extract the default export; Passes 2 and 3 use `runtimeParam.i(N)`
  for requires.

## How to test changes

```bash
npm run cleanup
node build/index.js refactor -m <path-to-next-mapped.json> -t next-turbopack -o /tmp/next-refactored
```

Spot-check a turbopack chunk (func_NNN) and a webpack chunk (no func_ prefix) side by side.
Verify that exported names appear as `export const name = ...` or `export { local as name }`,
and that `require(N)` calls become `import * as name from "./N.js"`.
