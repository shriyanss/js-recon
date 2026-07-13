# `src/lazyLoad/react` — React chunk crawler

## Purpose

Discovers and downloads React JS chunks. Covers both CRA-style apps (single `main.<hash>.js` + numbered async chunks) and webpack-config-customized SPAs.

## Files

- `react_getScriptTags.ts` — initial `<script>` extraction from the page.
- `react_webpackChunkPaths.ts` — parses webpack's chunk path templates (e.g. `__webpack_require__.p + "static/js/" + chunkId + "." + hashMap[chunkId] + ".chunk.js"`) to enumerate every async chunk URL.
- `react_followImports.ts` — walks `import()` calls in downloaded chunks to discover further chunks.
- `react_sourcemapUrls.ts` — pulls source maps where available.

## Patterns / gotchas

- **Hash maps are inline.** Webpack emits a literal `{0: "abc123", 1: "def456", ...}` table in the entry chunk; `react_webpackChunkPaths` parses it. If hashing format changes (rare), this is the single point that needs updating.
- **No buildId concept.** Unlike Next, every chunk URL is fully derivable from the entry chunk's chunk-path template + hash map.
- **CRA vs custom webpack.** CRA outputs are well-behaved; custom webpack configs sometimes use `[name].[contenthash].js` formats. The path-template parser handles both; if a target breaks, log the raw template before patching.
- **`__vite_mapDeps` path resolution differs between frameworks.** Vite bundles include a lazy-load dependency table (`m.f = [...]`) that `react_followImports` parses. Three path formats exist in the wild: (1) absolute `/assets/chunk.js` (leading `/`), (2) bare `assets/chunk.js` (no leading `/` or `./`), and (3) explicit relative `../nodes/0.js`. Cases (1) and (2) are both root-relative — Vite emits them relative to the site root, not the chunk's directory — and are resolved against `baseUrl` (the origin). Only case (3) (`./` or `../` prefix) is file-relative and is resolved against `fileUrl`. Do not treat bare names like `assets/x.js` as file-relative; they would incorrectly double-up the directory segment when the chunk itself sits under `assets/`.

## How to test changes here

```bash
npx tsc && node build/index.js lazyload -u <react-target> -y
```

Full acceptance via `run` per root `CLAUDE.md`.

## See also

- `../techDetect/checkReact.ts`
- `../../map/react_js/` — consumer.
