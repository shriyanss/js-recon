# `src/map/react_js` — React resolvers

## Purpose

Resolution for React bundles (typically webpack-emitted; vite/CRA mixed). Owns React-specific connection extraction and `fetch` resolution; delegates XHR and HTTP-client wrapper resolution to `../vue_js/` (those resolvers are framework-agnostic by design).

## Files

- `getReactConnections.ts` — extracts the module graph from React-style webpack output. Distinct from Next's `getWebpackConnections.ts` because the chunk wrapper shape differs.
- `react_resolveFetch.ts` — `fetch(...)` resolver for React chunks.
- `interactive.ts` — interactive REPL entry for React.

## Patterns / gotchas

- **Thin dir by design.** XHR and HTTP-client wrappers (`vue_resolveXhr`, `vue_resolveHttpClient`) are imported from `../vue_js/`. Do not add parallel implementations here — extend the shared resolver instead.
- **Connection extraction is the React-specific piece.** If a new React bundler variant emerges (e.g. RSPack), add a new connection extractor here rather than touching shared resolvers.
- **No taint utils of its own.** Uses `../vue_js/taint_utils.ts` indirectly via the shared HTTP-client resolver.

## How to test changes here

```bash
npx tsc
node --max-old-space-size=8192 build/index.js map \
  -d output/<host>/static/js -o /tmp/jsr-mapped -t react -f json
```

Full acceptance via `run` per root `CLAUDE.md`.

## See also

- `../vue_js/` — the actual home of XHR / HTTP-client resolvers used here.
- `../../lazyLoad/react/` — chunk source.
