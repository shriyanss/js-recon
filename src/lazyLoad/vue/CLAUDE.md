# `src/lazyLoad/vue` — Vue chunk crawler

## Purpose

Discovers and downloads Vue (Vite-built) chunks. Vue bundles spread across asset hosts and don't have a single manifest, so this crawler combines several discovery strategies: page-source script extraction, runtime JS interception, vite dep-map parsing, string scans, and a recursive client-side path crawl.

## Files

- `vue_pageSrc.ts` — initial page HTML scan for `<script type="module">` and asset links.
- `vue_RuntimeJs.ts` — captures JS loaded at runtime via Puppeteer interception.
- `vue_jsImports.ts` — parses `import` / `import()` statements in already-downloaded chunks to enumerate dependencies.
- `vue_viteMapDeps.ts` — parses Vite's `__VITE_MAP_DEPS__` / `__vitePreload` calls to find chunks loaded conditionally.
- `vue_discoverJsFiles.ts` — top-level orchestrator over the strategies above.
- `vue_stringJsFiles.ts` — string-scan fallback for chunk URLs hardcoded in JS.
- `vue_SingleJsFileOnHome.ts` / `vue_severalJsFilesHome.ts` — variants for sites with one vs many entry chunks.
- `vue_getClientSidePaths.ts` / `vue_recursiveClientSidePathDownload.ts` — extracts router paths and re-crawls them to pick up route-specific chunks.
- `vue_sourcemapExtract.ts` / `vue_reconstructSourceMaps.ts` — pull `.map` files and reconstruct source trees where present.

## Patterns / gotchas

- **No buildId / manifest** for vite. Multi-strategy discovery is unavoidable; do not try to collapse to a single function.
- **Cross-host chunks are normal.** `map` step uses CDN-dir detection because Vue chunks frequently come from a different host than the page. Crawler MUST preserve original host in output paths.
- **Recursive client-side path crawl** can explode on sites with parameterized routes. The recursion is bounded — adjust the limit in `vue_recursiveClientSidePathDownload.ts` rather than removing the bound.
- **Sourcemap reconstruction is optional.** If `.map` is absent or invalid, fall through silently. Some Vue apps ship maps in production.
- **Research mode.** `vue_discoverJsFiles` / `vue_recursiveClientSidePathDownload` accept an optional trailing `onTechnique` callback used to attribute discovered URLs to the specific internal technique (page src, RuntimeJs, viteMapDeps, etc.) when `--research` is enabled — see `../CLAUDE.md`.

## How to test changes here

```bash
npx tsc && node build/index.js lazyload -u <vue-target> -y
find output/<host> -name "*.js" | wc -l
```

Full acceptance via `run` per root `CLAUDE.md`.

## See also

- `../techDetect/checkVueJS.ts`
- `../../map/vue_js/` — primary consumer.
