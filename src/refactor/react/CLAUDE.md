# `src/refactor/react` — webpack React bundle splitter

## Purpose

Splits a webpack 5 React bundle (the numeric module map `var e = { 540(e,n,t){…}, 287(e,n){…}, … }`) into individual ECMAScript module files, one per numeric module ID.

## File layout

| File | Responsibility |
|------|---------------|
| `index.ts` | Entry point: parses the bundle AST, collects `ModuleEntry` objects, orchestrates the transform + validate loop, returns `Record<moduleId, code>` |
| `transform.ts` | `transformModule(mod)` — four-pass AST rewrite that converts one webpack module function into ES module statements |
| `helpers.ts` | Pure AST pattern matchers and export-builder utilities |
| `validator.ts` | `validateAndFix` — iterative Babel strict-parse → fix loop |

## Webpack module shapes

Two param signatures appear in React webpack bundles:

| Shape | Params | Meaning |
|-------|--------|---------|
| 3-param | `(module, exports, require)` | Normal module — has require calls and may populate `exports` |
| 2-param | `(module, exports)` | Pure export module — no require; populates `exports.<prop>` directly |

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

## Gotchas

- **Top-level only.** Never use `fnPath.traverse()` for Passes 1 and 2 — it recurses into nested functions and emits `export` inside them.
- **`export * from` does not re-export default.** If the target module has a default export, callers must use `import defaultVal from "./N.js"` separately.
- **Vite/Rollup bundles.** These don't use the numeric-keyed module map pattern; `isInModuleMap` will find nothing and 0 modules will be processed. That's expected.
- **String-keyed exports.** `export { x as "prop-name" }` is ES2022. The validator's downgrade step handles parsers that don't support it.
