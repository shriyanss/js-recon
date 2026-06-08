# `src/endpoints` — client-side route extraction

## Purpose

Powers the `endpoints` subcommand and pipeline step 8 (Next.js). Walks downloaded JS / `mapped.json` and emits `endpoints.json`: the set of client-side route patterns the SPA can render. This is distinct from API endpoints — those come from `map`.

## Files

- `index.ts` — entrypoint. Reads tech, dispatches: Next.js gets full extraction; other frameworks currently fall through (Vue's `endpoints.json` is written as `[]` by `report`).
- `next_js/` — Next.js client-side route extractors. See `next_js/CLAUDE.md`.
- `gen_report/` — output formatters; produces the JSON consumed by `report`. See `gen_report/CLAUDE.md`.

## Patterns / gotchas

- **Next-only today.** Adding Vue/React/Svelte support means a new subdir here PLUS wiring in `index.ts` AND removing the `report`-level fallback in `../run/index.ts`. Don't half-implement.
- **`___subsequent_requests` directory** is the signal `index.ts` uses to decide whether a JS dir is available. If absent, extraction degrades silently — check this before debugging "no endpoints found".
- **Route format must match `report`'s schema.** `gen_report/gen_json.ts` is the contract; any new extractor must produce records of the same shape or the SQLite populate step will skip them.

## How to test changes here

```bash
npx tsc && node build/index.js endpoints -d output/<host> -o /tmp/jsr-endpoints
```

Full acceptance via `run` per root `CLAUDE.md`.

## See also

- `../map/` — different output type (API endpoints), often confused with this dir.
- `../report/` — consumes `endpoints.json`.
