# `src/map/angular_js` — Angular resolvers

## Purpose

Resolution for Angular bundles built with the Angular CLI's esbuild backend (Angular 17+). Parses downloaded chunks into `Chunks` objects and delegates HTTP-client resolution to the shared `vue_js/` resolvers.

## Files

- `getAngularConnections.ts` — reads every `.js` file from the Angular download directory, parses each with Babel, and returns a `Chunks` map keyed by sanitised filename. Angular's esbuild output is a dense IIFE (`main-HASH.js`) plus optional lazy-route chunks (`chunk-HASH.js`); each file is emitted as one chunk rather than split by function. Polyfill bundles (`polyfills-*.js`) are skipped — they contain only Zone.js and browser compatibility shims with no app API calls.
- `interactive.ts` — re-exports the Vue interactive REPL (all commands are framework-agnostic).

## Patterns / gotchas

- **Whole-file chunks.** Unlike React/Vite (which splits files at 2-char root function boundaries), Angular's IIFE format has no natural split point. Each `.js` file is one chunk. ESQuery rules and HTTP-client resolvers still find all patterns because they scan the full chunk code.
- **HTTP-client delegation.** `vue_resolveHttpClient` and `vue_resolveFetch` from `../vue_js/` handle Angular's `HttpClient` calls, which compile to generic method calls (`n.get(url)`, `n.post(url, body)`). Pass `"Angular"` as the `frameworkName` argument so log messages are labelled correctly.
- **No taint utils of its own.** Uses `../vue_js/taint_utils.ts` indirectly via the shared HTTP-client resolver.
- **Polyfill skip.** Files whose basename starts with `polyfills-` or `polyfills.` are excluded from analysis — they're vendor code and would only add noise.

## How to test changes here

```bash
npx tsc
node --max-old-space-size=8192 build/index.js map \
  -d output/<host> -o /tmp/jsr-mapped -t angular -f json
```

Full acceptance via `run` per root `CLAUDE.md`.

## See also

- `../vue_js/` — XHR / HTTP-client resolvers used here.
- `../../lazyLoad/angular/` — chunk source.
