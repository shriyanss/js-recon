# `src/lazyLoad/angular` — Angular chunk crawler

## Purpose

Discovers and downloads Angular JS chunks. Angular CLI builds emit a predictable file layout (`main-HASH.js`, `polyfills-HASH.js`, lazy-loaded route chunks); this crawler enumerates them from page source and `main.js`.

## Files

- `angular_getFromPageSource.ts` — extracts the entry chunks (`main`, `polyfills`, `runtime`, `styles`) from page HTML.
- `angular_getFromMainJs.ts` — parses `main.js` for the lazy-load chunk table used by Angular's router.

## Patterns / gotchas

- **Full pipeline supported.** After lazyload, Angular targets continue through map → analyze → report (4-step pipeline). The map module (`src/map/angular_js/`) parses the downloaded chunks; the analyze module applies security rules; the report module generates the HTML/SQLite report.
- **Two-file split is the whole crawler.** No recursion, no re-pass. Angular's lazy-load table is comprehensive; if a target's routes aren't surfacing, the parser in `angular_getFromMainJs.ts` is the only thing to look at.

## How to test changes here

```bash
npx tsc && node build/index.js lazyload -u <angular-target> -y
ls output/<host>
```

## See also

- `../techDetect/checkAngularJS.ts`
- `../../map/angular_js/` — downstream map module.
