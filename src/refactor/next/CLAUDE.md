# `src/refactor/next` — Next.js Turbopack chunk refactor (`-t next-turbopack`)

## Purpose

Rewrites Next.js (Turbopack) bundle chunks into readable ECMAScript module files during manual
resolver development.  Handles both the native turbopack module format and the webpack-style
modules that coexist in a turbopack bundle.

## Module formats

### 1. Turbopack 3-param format (`func_NNN = (runtime, module, exports) => { ... }`)

The dominant format (190/194 chunks in a typical Next.js turbopack build). The params map as:

| Position  | Role    | Usage                                                                |
|-----------|---------|----------------------------------------------------------------------|
| params[0] | runtime | turbopack runtime — `runtime.r(N)` / `runtime.i(N)` for imports     |
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
element nodes.  Handles string/identifier tags, props as JSXAttributes, `children` array, and
nested jsx calls.

### Pass G — Babel helper removal

Strips top-level function declarations that are Babel runtime helpers: `_typeof`,
`_defineProperty`, `_arrayLikeToArray`, `_slicedToArray`, `_objectSpread2`, etc.

### Pass H — prune unused named imports

After JSX recovery the `jsx`/`jsxs` import specifiers often become stale — Pass H removes any
named import specifier whose local name has no reference in the body.

## Files

| File            | Responsibility                                                                 |
|-----------------|--------------------------------------------------------------------------------|
| `index.ts`      | Entry: detects format, extracts params, calls transform, validates output       |
| `transform.ts`  | All AST passes (1, 2, 3, E, F, G, H) for both turbopack and webpack modules   |
| `helpers.ts`    | Pure AST pattern matchers and export/import builders                           |
| `validator.ts`  | `validateAndFix` — iterative Babel strict-parse → downgrade/drop loop         |

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
