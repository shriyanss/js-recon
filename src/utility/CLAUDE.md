# `src/utility` — shared helpers and global state

## Purpose

Cross-cutting utilities used by every other dir. Owns the mutable global state, the Puppeteer singleton, the sandbox-aware HTTP client, and the OpenAPI / Postman serializers.

## Files

- `globals.ts` — mutable singletons: tech string (set by lazyload, read everywhere), AI config, OpenAPI-enabled flag, request-engine state. Use the exported setters/getters — never mutate the module object directly.
- `interfaces.ts` — `Chunks` and other types shared across `map` / `analyze` / `report`.
- `puppeteerInstance.ts` — Puppeteer browser singleton. Lazy-launched on first call; `close()` is responsibility of the caller that owns the lifecycle (typically `run`).
- `makeReq.ts` — HTTP client. Two modes: direct (fetch-like) and sandboxed (delegates to `runSandboxed.ts`). Sandbox mode is used for any URL that might be a target's own JS executing untrusted code.
- `runSandboxed.ts` + `configureSandbox.ts` — VM-based sandbox for evaluating untrusted code from target bundles.
- `openapiGenerator.ts` — assembles `mapped-openapi.json` from resolved endpoint records. Single source of truth for the OpenAPI shape. Respects `OpenapiOutputItem.collectionFolder`: when set, that string is used as the operation's `tags` value, overriding the default chunk-id tag behaviour.
- `postmanGenerator.ts` — Postman collection v2 export. When an item carries `collectionFolder`, it is placed under a flat top-level folder with that name and the path-segment-derived folder hierarchy is bypassed (used by the GraphQL resolver to keep every operation under a single `GraphQL` folder). The collection's `variable` array exposes both `baseUrl` and `graphqlEndpoint` so importers get a working substitution out of the box.
- `progressLog.ts` — CLI progress bars (chalk + readline cursor moves). Used by lazyload and strings.
- `ai.ts` — direct (non-MCP) LLM helper. Distinct from `../mcp/providers.ts`; this is for one-shot internal AI calls (e.g. inferring a chunk's role).
- `resolvePath.ts`, `urlUtils.ts`, `replaceUrlPlaceholders.ts` — URL/path canonicalization. `urlUtils.looksLikeUrl` is the heuristic that gates OpenAPI emission across all map resolvers.

## Patterns / gotchas

- **Globals are mutable singletons.** Setting tech mid-pipeline breaks downstream resolvers. Treat globals as set-once-during-lazyload, read-only afterwards (except batch-mode `clearJsUrls()` etc.).
- **`looksLikeUrl` is load-bearing.** Tightening it drops endpoints across every framework. See `../map/CLAUDE.md`.
- **Sandbox vs direct in `makeReq`.** Default is sandboxed for safety. Direct mode is only for trusted endpoints (e.g. AWS gateway provisioning). Don't flip the default.
- **Puppeteer reuse.** Multiple sequential URLs in batch mode share one browser; the browser carries page state. `processUrl` is responsible for clean page setup, not this dir.
- **No circular deps with `lazyLoad/globals.ts`.** That file owns URL sets; this one owns tool-wide state. Don't merge them — the split exists so batch mode can clear lazyload state without touching tool state.

## How to test changes here

No standalone command — utilities are exercised by every subcommand. Pick the closest consumer (`map` for `urlUtils`, `lazyload` for Puppeteer, `analyze` for `makeReq`) and run that.

## See also

- Root `CLAUDE.md` § "Key source files" for cross-dir context.
