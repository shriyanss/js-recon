# `src/refactor/react-vite` — Vite React bundle refactor

## Purpose

Splits a Vite-bundled (rolldown) React application into human-readable ES module files. Unlike the webpack refactor, Vite already produces split ESM chunks — one file per route or logical boundary. The transform does not split files; instead it removes bundler boilerplate (interop wrappers, CJS shims) and recovers clean library imports and JSX syntax.

## File layout

| File                 | Responsibility                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`           | Entry point: classifies chunks, orchestrates the multi-pass transform, returns `Record<chunkKey, code>` |
| `vendor-analyze.ts`  | `analyzeVendorChunk(code)` — parses the vendor chunk and returns a `Map<exportedName, VendorExportInfo>` used to classify interop vars |

## Vite/rolldown bundle format

A Vite production build (rolldown bundler) produces:

- **`rolldown-runtime-*.js`** — tiny helper module that exports `__toESM` (as `n`) and `__commonJS` (as `t`). Never processed, just identified and skipped.
- **`vendor-react-*.js`** — CJS library wrappers and direct react-router-dom exports. Contains `var X = t(factory)` wrappers for React/jsx-runtime/react-dom, and function declarations for react-router-dom APIs with `.displayName` assignments.
- **`vendor-react-dom-*.js`** — Additional vendor chunk when react-dom is split separately. Same structure.
- **App chunks** (`index-*.js`, `Home-*.js`, etc.) — application code. Each chunk:
  - Imports rolldown interop helpers from the runtime chunk (usually skipped by the refactor)
  - Imports vendor exports by short alias: `import { r as n, t, s as a } from './vendor-react-*.js'`
  - Uses CJS interop: `var i = n(t(), 1)` (`__toESM(getter(), 1)`) or bare `var a = r()` (getter call)
  - Calls library APIs as `(0, i.useState)(args)` or `(0, a.jsxs)(tag, props)`
  - Template literal tags: rolldown uses `` `div` `` (template literal) instead of `"div"` for intrinsic HTML element names in jsx/jsxs calls

## Transform passes

The transform runs in `refactorVite()` in `index.ts`:

**Step 1 — Vendor chunk collection**  
All vendor chunks are identified (filename matches `/vendor[-_]react/i`). Each is parsed and analyzed by `analyzeVendorChunk()` in `vendor-analyze.ts`, producing a `Map<exportedName, VendorExportInfo>` keyed by the short name used in the vendor chunk's `export { ... }` statement (e.g. `r`, `n`, `t`).

**Step 2 — App chunk classification (per chunk)**  
`buildLocalVarToVendorExport(statements, vendorExportMaps)` maps each local import alias (e.g. `n` imported from the vendor chunk) to its `VendorExportInfo`. Then `detectInteropVars(statements, toEsmLocalName, localVarToVendorExport)` scans all `var` declarations and classifies two patterns:
- `var x = toEsm(getter(), 1)` — CJS interop via `__toESM`
- `var x = getter()` — bare getter call (direct CJS unwrap)

Both are classified using the vendor export map to identify which library they refer to, and what the export map looks like for that library (e.g. `{ jsx: "jsx", jsxs: "jsxs" }` for jsx-runtime).

**Step 3a — Boilerplate removal**  
Removes import declarations for the rolldown-runtime chunk (the interop helper imports are no longer needed after the transform).

**Step 3b — Interop var removal (split)**  
Removes only the interop var declarators from `var` statements, keeping non-interop declarators in the same statement. E.g. `var i = n(t(), 1), a = r(), o = 'sk-key-...'` → `var o = 'sk-key-...'` (keeps `o`, drops `i` and `a`).

**Step 3c — `(0, X.prop)(args)` rewriting**  
Rewrites library API calls from the indirect call pattern to bare identifiers: `(0, i.useState)(args)` → `useState(args)`. Uses the classified interop vars to know which library each var belongs to and what its canonical export names are.

**Step 3d — Direct vendor import rewriting**  
`rewriteVendorImports()` rewrites the `import { r as n, t, s as a } from './vendor-react-*.js'` statement to canonical library imports: `import { useState, useEffect } from 'react'`, `import { jsx, jsxs } from 'react/jsx-runtime'`, etc.

**Steps 3e–3j (shared passes from `react/transform.ts`)**  
`applyModuleCleanupPasses()` runs passes that are shared with the webpack refactor:
- **Pass E** — `slicedToArray` collapse (array destructure recovery)
- **Pass F** — JSX recovery: `jsx('div', {...})` → `<div ...>`. Handles both string literal and template literal tag names (`` `div` `` → `div`).
- **Pass G** — Removes Babel helper functions (`_typeof`, `_defineProperty`, etc.)
- **Pass H** — Prunes unused named import specifiers

## Vendor chunk analysis (`vendor-analyze.ts`)

`analyzeVendorChunk(code)` returns `Map<exportedName, VendorExportInfo>` where each entry describes:
- `canonicalName` — the library API name (e.g. `"react"`, `"react/jsx-runtime"`, `"Link"`)
- `library` — the library package (`"react"`, `"react/jsx-runtime"`, `"react-dom/client"`, `"react-router-dom"`)
- `isCjsGetter` — whether this export is a CJS module getter (needs interop unwrapping)

**CJS wrapper detection** uses `classifyFactory()` which inspects the factory AST directly:
- Checks for `createRoot` → `react-dom/client`
- Checks for `${exportsParam}.jsx =` and `${exportsParam}.jsxs =` → `react/jsx-runtime`
- Checks for `react.element` / `ReactCurrentOwner` → `react`

Wrapper chains are resolved: `var r = t((e, t) => { t.exports = n() })` (where `n` is the React CJS getter) is detected by scanning for `t.exports = Y()` patterns inside the factory body, including sequence expression form `(n(), t.exports = Y())`.

**react-router-dom detection** uses `.displayName` assignments: `` Link.displayName = `Link` `` (template literal RHS is handled explicitly). Falls back to `extractRouterDomCanonical()` heuristic scanning for backtick strings, call patterns, and JSX element names.

## Build check (`index.ts` → `runViteBuildCheck()`)

After writing refactored files, a Vite scaffold is created in the output directory:
- `package.json` with `react`, `react-dom`, `react-router-dom`, `@vitejs/plugin-react`, `vite`
- `vite.config.js` with `plugins: [react()]` and the entry file in `build.rollupOptions.input`
- `index.html` pointing to the entry

Files are renamed from `.js` to `.jsx` before the build — Vite's `vite:build-import-analysis` plugin runs before esbuild/plugin-react and cannot parse JSX in `.js` files. After renaming, all relative dynamic imports inside the files are updated from `./Foo.js` to `./Foo.jsx` so they resolve correctly.

The entry file is selected by finding the `.jsx` file that contains `createRoot(`.

## Output filenames

Output files are named using the original Vite chunk basename from `chunk.file` (e.g. `Home-J6pOhRyO.js`), not a sanitized version of the chunk key. This ensures the dynamic imports already present in the refactored code (`import('./Home-J6pOhRyO.js')`) resolve correctly against the output files.

## Key invariants

- **Template literal tags**: rolldown uses `` `div` `` (template literal) instead of `"div"` (string) for intrinsic HTML element tag names and text children in `jsx`/`jsxs` calls. `exprToJsxName()` and `childToJsxChild()` in `react/transform.ts` handle both forms.
- **exports parameter naming**: rolldown factory functions use variable names like `e` for the exports parameter, so checks must look for `${exportsParam}.jsx =` not hardcoded `exports.jsx =`.
- **Multi-declarator splitting**: interop var removal must split `var` statements rather than dropping the whole statement — non-interop declarators (e.g. API keys, constants) in the same statement must be preserved.
- **Vendor chunk matching is exact**: `buildLocalVarToVendorExport` matches against the exact source value in import declarations, not a prefix or heuristic. Multiple vendor chunks are all analyzed and stored in a `Map<vendorBasename, exportMap>`.

## How to test changes here

```bash
npx tsc && node build/index.js refactor -m <path-to-vite-mapped.json> -t react-vite -o /tmp/refactored-vite --no-remote
```

The build check runs automatically after writing files. A passing build (`[✓] Vite build check passed`) confirms the output is syntactically valid JSX that Vite can compile.

To generate a `mapped.json` from a Vite `dist/assets` directory:

```javascript
const fs = require('fs'), path = require('path');
const dir = 'dist/assets';
const chunks = {};
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    const key = f.replace(/\.js$/, '');
    chunks[key] = { id: key, code: fs.readFileSync(path.join(dir, f), 'utf8'),
                    file: 'assets/' + f, description: '', loadedOn: [],
                    containsFetch: false, isAxiosLibrary: false, exports: [], callStack: [], imports: [] };
}
fs.writeFileSync('mapped.json', JSON.stringify(chunks, null, 2));
```
