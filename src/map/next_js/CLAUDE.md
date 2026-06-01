# `src/map/next_js` — Next.js resolvers (webpack + turbopack)

## Purpose

Framework-specific resolution for Next.js bundles. Reads chunks from `lazyLoad/next_js`'s output, walks webpack/turbopack module graphs, resolves `fetch()` / `axios` / `new Request()` / server-action calls into concrete URL records, and emits OpenAPI entries.

## Files

- `getWebpackConnections.ts` — extracts module graphs from webpack-emitted chunks (`(self.webpackChunk_N_E = ...).push(...)`). Returns a chunk map keyed by module id.
- `getTurbopackConnections.ts` — same role for turbopack output. Parallel implementation; do NOT merge.
- `getExports.ts` — resolves `__webpack_exports__` / `__turbopack_export_value__` to local bindings; foundation for all cross-module resolution.
- `getFetchInstances.ts` / `resolveFetch.ts` — finds and resolves `fetch(...)` callsites. Detects framework chunks (Next internals) to skip noise.
- `getAxiosInstances.ts` / `resolveAxios.ts` / `resolveAxiosHelpers/` — axios instance discovery and per-instance method resolution. Helpers dir holds the per-method dispatch (get/post/...).
- `resolveNewRequest.ts` — `new Request(...)` constructor calls (used by some Next data fetchers).
- `resolveServerActions.ts` — Next-only. Detects `createServerReference(actionId, ...)`, derives the App Router route from the chunk file path, traces argument callsites (same-chunk and cross-chunk), and emits POST endpoints with `next-action` headers + typed arg hints (e.g. `<string:userId>`).
- `utils.ts` — large shared helper library: `resolveNodeValue`, `resolveVariableInChunk`, `substituteVariablesInString`. Used by every resolver in this dir.
- `interactive.ts` + `interactive_helpers/` — blessed-backed interactive REPL and headless command runner.
- `interactive_helpers/esqueryGen.ts` — framework-agnostic; `vue_js/` and `svelte_js/` import directly. Don't add Next-isms here.
- `interactive_helpers/inputPatch.ts` — `enableCursorInput` patches a blessed textbox to support cursor movement & paste. Override is at the instance level because blessed re-binds `_listener` on focus. Shared with Vue interactive. See root `CLAUDE.md` for the longer rationale.

## Patterns / gotchas

- **Webpack vs turbopack parallel files.** Two separate connection extractors; choosing between them is automatic based on chunk shape. Don't unify — turbopack format changes more often.
- **Framework-chunk skipping.** `resolveFetch` knows to skip Next.js internals (e.g. `_next/static/chunks/framework-*.js`). Adding a new "chunk type" detector belongs there, not at the dispatcher level.
- **`utils.ts` is shared across resolvers.** Changing `resolveNodeValue`'s contract impacts every resolver in this dir AND in `vue_js/` (which has its own taint utils built on similar primitives — but the two should stay independent).
- **Server actions are Next-only.** `list server_actions` in the interactive shell filters by `next-action` header — no Vue counterpart.
- **Interactive commands must be mirrored** in `vue_js/interactive_helpers/commandHandler.ts` unless intentionally Next-only.

## How to test changes here

Fast loop after editing a resolver:

```bash
npx tsc
node --max-old-space-size=8192 build/index.js map \
  -d output/<host>/static/js -o /tmp/jsr-mapped -t next -f json
grep -F "<expected fragment>" /tmp/jsr-mapped/mapped-openapi.json
```

Full acceptance via `run` per root `CLAUDE.md`.

## See also

- `../vue_js/` — sibling framework dir; check before duplicating logic.
- `../../lazyLoad/next_js/` — chunk source.
- Root `CLAUDE.md` § "Reversing RPC-style API calls" for the resolver-extension workflow.
