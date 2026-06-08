# `src/lazyLoad/svelte` — Svelte/SvelteKit chunk crawler

## Purpose

Discovers and downloads SvelteKit JS chunks. SvelteKit's client routing emits per-route chunks under `_app/immutable/`; this crawler enumerates them from the entry HTML, follows imports, and recursively visits client-side routes to surface route-specific chunks.

## Files

- `svelte_getFromPageSource.ts` — initial extraction from page HTML.
- `svelte_stringAnalysisJSFiles.ts` — string-scan downloaded chunks for additional chunk URLs.
- `svelte_discoverPagesFromJs.ts` — finds client-side route declarations in chunks.
- `svelte_recursivePageCrawl.ts` — re-visits each discovered route to pick up route-specific chunks.

## Patterns / gotchas

- **`_app/immutable/` is the canonical path.** SvelteKit hashes all assets; URLs are stable per build but unique per deploy.
- **Route-driven crawl.** Unlike Next/Vue, SvelteKit's chunks are most reliably surfaced by visiting each route. Recursion bound matters — don't remove it.
- **No source maps in prod by default.** SvelteKit strips them; don't bother retry-fetching.

## How to test changes here

```bash
npx tsc && node build/index.js lazyload -u <svelte-target> -y
```

Full acceptance via `run` per root `CLAUDE.md`.

## See also

- `../techDetect/checkSvelte.ts`
- `../../map/svelte_js/` — consumer.
