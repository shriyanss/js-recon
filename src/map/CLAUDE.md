# `src/map` — bundle parsing and endpoint resolution

## Purpose

Powers the `map` subcommand. Parses downloaded JS bundles (webpack / turbopack / vite) into a structured `mapped.json` and emits `mapped-openapi.json`. This is where every URL the tool reports comes from — adding support for a new HTTP transport almost always means new code here.

## Files

- `index.ts` — dispatcher. Reads `globalsUtil.getTech()` and routes to one of the framework subdirs. Handles `-i` interactive mode and `-c/--command` headless command list.
- `graphql/resolveGraphql.ts` — framework-agnostic GraphQL operation extractor. Walks every `.js`/`.mjs` file under the input directory, traverses `StringLiteral` and `TemplateLiteral` nodes via Babel, and feeds candidates through the `graphql` library's `parse()`. Successfully-parsed `OperationDefinition`s are emitted as POST requests under a flat `GraphQL` collection folder; referenced fragment definitions are collected across all files in a first pass and inlined into each operation's printed query. Independent of taint analysis — relies only on the operation text existing as a literal somewhere in the bundle.
- `next_js/` — Next.js webpack & turbopack resolvers (fetch, axios, server actions, new Request). See `next_js/CLAUDE.md`.
- `vue_js/` — Vite/webpack resolvers for Vue. Hosts the framework-agnostic HTTP-client and XHR resolvers reused by React/Svelte. See `vue_js/CLAUDE.md`.
- `react_js/` — React-specific connection and fetch resolvers; delegates XHR / HTTP-client to `vue_js/`. See `react_js/CLAUDE.md`.
- `svelte_js/` — Svelte interactive shim; delegates resolution to `vue_js/`. See `svelte_js/CLAUDE.md`.

## Patterns / gotchas

- **Tech dispatch is dynamic.** Adding a new framework means a new subdir + a branch in `index.ts`. Resolvers MUST NOT be cross-imported casually — if a resolver is framework-agnostic, put it in `vue_js/` and import it from elsewhere (the established convention).
- **Webpack vs turbopack** (Next-only) live side-by-side in `next_js/`. Same logical step, different chunk shape — keep them as parallel files, don't merge.
- **GraphQL extraction is gated by `--openapi`.** `resolveGraphql` runs once per framework branch in `index.ts`, right before the OpenAPI/Postman emit block, guarded by both `getOpenapi()` and `getGraphqlEnabled()`. Operations bypass `looksLikeUrl` filtering because their path (`/{{graphqlEndpoint}}`) is a synthetic placeholder, not a resolved URL. They are grouped by the `collectionFolder` field on `OpenapiOutputItem` (see `utility/CLAUDE.md`).
- **OpenAPI emission is filtered.** Every resolver eventually produces entries that pass through `urlUtils.looksLikeUrl` before being written. Heuristic rejects entries without `/` or scheme; partially-resolved URLs (`[call:base()]/x`) survive as long as the literal portion contains a slash. Tightening that heuristic silently drops endpoints across all frameworks.
- **Interactive shell is per-framework** but commands are shared where possible. New commands go in BOTH `next_js/interactive_helpers/commandHandler.ts` and `vue_js/interactive_helpers/commandHandler.ts` unless intentionally Next-only (e.g. `list server_actions`).
- **Per-file size limit (1.5 MB).** All file-reading loops in `vue_js/getViteConnections.ts`, `react_js/getReactConnections.ts`, `vue_js/vue_resolveFetch.ts`, `vue_js/vue_resolveXhr.ts`, and `vue_js/vue_resolveHttpClient.ts` skip files larger than 1.5 MB before calling Babel. This prevents OOM crashes on ad-heavy sites that download 100+ large third-party JS files. If you raise this threshold or remove the guard, test against a site with many large vendor scripts first.

## How to test changes here

Skip `lazyload` while iterating — reuse already-downloaded chunks:

```bash
npx tsc
node --max-old-space-size=8192 build/index.js map \
  -d output/<host>/static/js -o /tmp/jsr-mapped -t <next|vue|react|svelte> -f json
```

Grep `mapped-openapi.json` for the URL fragment you expect. Final acceptance: `npm run cleanup && npm run start -- run -u <target> -y -k` per root `CLAUDE.md`.

## See also

- Root `CLAUDE.md` § "Reversing RPC-style API calls" for the resolver-extension workflow.
- `../lazyLoad/` — produces the chunk input.
- `../analyze/` — consumes `mapped.json`.
