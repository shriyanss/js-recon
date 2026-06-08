# `src/map/svelte_js` — Svelte resolvers

## Purpose

Resolution for Svelte/SvelteKit bundles. Currently the thinnest framework dir — connection extraction reuses vite logic from `../vue_js/`, and all URL resolvers (fetch, XHR, HTTP-client) are imported from there.

## Files

- `interactive.ts` — interactive REPL entry for Svelte.
- `interactive_helpers/` — Svelte-specific REPL commands; mostly re-exports from `../next_js/interactive_helpers/` and `../vue_js/interactive_helpers/`.

## Patterns / gotchas

- **No SvelteKit-specific resolver yet.** If SvelteKit's `+server.ts` / route conventions need first-class handling, this is where it would live. Today, SvelteKit's client-side fetch calls are caught by the shared HTTP-client / fetch resolvers.
- **Delegate, don't duplicate.** Same rule as `../react_js/`: extend the shared resolvers in `../vue_js/` rather than re-implementing here.
- **Interactive commands must be kept in sync** with the Next/Vue command handlers — adding a command in one place and forgetting the others creates UX inconsistency.

## How to test changes here

```bash
npx tsc
node --max-old-space-size=8192 build/index.js map \
  -d output/<host>/static/js -o /tmp/jsr-mapped -t svelte -f json
```

Full acceptance via `run` per root `CLAUDE.md`.

## See also

- `../vue_js/` — the home of the resolvers this dir relies on.
- `../../lazyLoad/svelte/` — chunk source.
