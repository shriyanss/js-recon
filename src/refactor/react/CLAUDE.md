# `src/refactor/react` — webpack React bundle splitter

## Purpose

Splits a webpack 5 React bundle (the numeric module map `var e = { 540(e,n,t){…}, 287(e,n){…}, … }`) into individual ECMAScript module files, one per numeric module ID.

## File layout

| File           | Responsibility                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`     | Entry point: parses the bundle AST, collects `ModuleEntry` objects, orchestrates the transform + validate loop, collects non-module IIFE content into `index.js`, returns `Record<moduleId, code>` |
| `transform.ts` | `transformModule(mod)` — four-pass AST rewrite that converts one webpack module function into ES module statements                                                                                |
| `helpers.ts`   | Pure AST pattern matchers and export-builder utilities                                                                                                                                            |
| `validator.ts` | `validateAndFix` — iterative Babel strict-parse → fix loop                                                                                                                                        |

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

Cleans up webpack-internal artifacts in the collected statements with three passes:

**Pass A** — Removes the webpack require helper function. Detection pattern: `FunctionDeclaration` with 1 param whose body contains `return (moduleMap[id](mod, mod.exports, fn), mod.exports)` — specifically a `ReturnStatement` with a 2-element `SequenceExpression` where the first element is a computed-member `CallExpression` and the second is a `<var>.exports` `MemberExpression`. The helper name (e.g. `"t"`) is recorded for Passes B and C.

**Pass B** — Hoists top-level `var x = requireFn(N)` declarators to `import * as x from "./N.js"`. Reuses `tryExtractRequireCall` from `helpers.ts`. Records `numId → localName` in `importNameByNumId`.

**Pass C** — Replaces all remaining `requireFn(N)` calls anywhere in the statements (including inside nested function bodies) by traversing a synthetic `t.file(t.program(statements))`. Uses the same `importNameByNumId` map; synthesises `_jsr_module_N` for any module ID not already hoisted. Identical in structure to Pass 4 of `transformModule`.

## Gotchas

- **Top-level only.** Never use `fnPath.traverse()` for Passes 1 and 2 — it recurses into nested functions and emits `export` inside them.
- **`export * from` does not re-export default.** If the target module has a default export, callers must use `import defaultVal from "./N.js"` separately.
- **Vite/Rollup bundles.** These don't use the numeric-keyed module map pattern; `isInModuleMap` will find nothing and 0 modules will be processed. That's expected.
- **String-keyed exports.** `export { x as "prop-name" }` is ES2022. The validator's downgrade step handles parsers that don't support it.
- **`index.js` is plain JS in module mode.** `validateAndFix` uses `sourceType: "module"` but the `index.js` statements contain no imports/exports — they are regular JS declarations and expression statements, which are valid in module context.
