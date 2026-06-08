# `src/refactor` — deobfuscation / readability pass

## Purpose

Optional pass that rewrites minified chunks into a more readable form for human review. Not wired into the `run` pipeline — invoked manually after `lazyload` when a contributor wants to inspect specific chunks during resolver development.

## Files

- `index.ts` — entrypoint. Dispatches by tech (`next`, `react`).
- `next/index.ts` — Next.js refactor implementation. Walks the AST, normalizes identifier names where possible, runs Prettier on the output, writes to a sibling directory in `output/`.
- `react/index.ts` — React refactor implementation. Detects each webpack module function under `var e = { <numericId>: function(module, exports, require) { ... } }` (and 2-param re-export modules `function(module, exports) { module.exports = require(N) }`), rewrites `require(<n>)` to `require("./<n>.js")`, captures exports via `Object.defineProperty(<exports>, ...)`, `<require>.d(<exports>, { ... })`, and `<exports>.<minProp> = <X>.<canonical>` assignments. Classifies modules by content fingerprint (`react` via `<X>.current.<hook>(...)` call shape; `react/jsx-runtime` via exports of both `jsx` and `jsxs`; `react-dom/client` via export of `createRoot`); resolves re-export chains. Rewrites bundled user-code callsites documented in `refactor_observations/00-bundled-shape-shared.md`:
    - `(0, <reactLocal>.<hook>)(args)` → `<hook>(args)` + `import { <hook> } from "react";`
    - `(0, <jsxLocal>.jsx)(args)` → `jsx(args)` + `import { jsx, jsxs, Fragment } from "react/jsx-runtime";`
    - `<reactDomLocal>.<minProp>(args)` → `createRoot(args)` using the module's export map.
      Any unrecognised `(0, X.Y)(args)` is still flattened to `X.Y(args)`. Outputs the import lines at the top of the chunk file.

## Patterns / gotchas

- **Per-tech subdirs.** Each tech keeps its own AST pass under `<tech>/`; do NOT merge them. Webpack module wrappers are shared in shape, but each framework adds extras (Next.js runtime helpers, React refresh runtime, …).
- **Prettier is required.** Without formatting, the AST-normalized output is harder to read than the original minified code. Don't make Prettier optional.
- **Output goes to a sibling dir** (e.g. `output/<host>/static/js-refactored/`) — never overwrite the source chunks, downstream steps (`map`, `analyze`) still need them.
- **Lossy.** Identifier renaming can produce collisions; the exports walk can collapse multi-getter shapes; refactored code is for human inspection only, never feed it back into `map`.
- **Duplicate default export guard.** Webpack 5 / Vite bundles parsed with `sourceType: "unambiguous"` may already contain `export { X as default }` or `export default X` as real ESM statements in the source. The trailing-export logic in `react/index.ts` checks `codeHasDefaultExport` (a regex over the generated code) before appending another `export default`; omitting this check causes a `SyntaxError: Only one default export allowed per module` from Prettier.

## How to test changes here

```bash
npx tsc && node build/index.js refactor -m output/<host>/mapped.json -t <next|react> -o /tmp/refactored
```

Spot-check the refactored output by hand.

## See also

- `../map/next_js/` — the place that benefits from refactored chunks during resolver development.
