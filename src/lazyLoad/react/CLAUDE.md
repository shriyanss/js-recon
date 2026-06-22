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
- **`__vite_mapDeps` path resolution differs between frameworks.** Vite bundles include a lazy-load dependency table (`m.f = [...]`) that `react_followImports` parses. The path format varies by framework: Vue/React use root-relative paths (`"/assets/chunk.Abc123.js"`) while SvelteKit uses file-relative paths (`"../nodes/0.js"` relative to the entry chunk's own URL). Paths starting with `/` are resolved against `baseUrl` (the origin); all other paths are resolved against `fileUrl` (the chunk file that contains the mapDeps table). Do not prepend `/` blindly — SvelteKit's `"../nodes/0.js"` would become `"/../nodes/0.js"` → normalized to `"/nodes/0.js"` → wrong path.

## How to test changes here

```bash
npx tsc && node build/index.js lazyload -u <react-target> -y
```

Full acceptance via `run` per root `CLAUDE.md`.

## See also

- `../techDetect/checkReact.ts`
- `../../map/react_js/` — consumer.
