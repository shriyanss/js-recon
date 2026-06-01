# `src/endpoints/next_js` — Next.js client-route extractors

## Purpose

Extracts client-side route patterns from Next.js bundles. Several strategies run together; their results are unioned and deduplicated before being passed to `../gen_report/`.

## Files

- `client_jsFilesHref.ts` — scans chunks for `href` literals that look like internal route paths.
- `client_jsonParse.ts` — parses build manifest / route JSON blobs for declared routes.
- `client_mappedJsonFile.ts` — reads `mapped.json` (from the prior `map` step) and pulls route info already resolved there.
- `client_subsequentRequests.ts` — uses the `___subsequent_requests` dir contents as a signal for additional dynamic routes.

## Patterns / gotchas

- **Union of strategies.** Each file produces a partial route set; the orchestrator merges them. Removing a strategy reduces coverage on certain Next setups — don't disable one without confirming overlap with the others.
- **`___subsequent_requests` presence** is what gates `client_subsequentRequests.ts`. Absent dir = silently skipped. Check before debugging missing routes.
- **Dynamic segments preserved as-is.** `/users/[id]` stays `[id]` — don't normalize to `:id` here; the report renderer handles display formatting.
- **App Router vs Pages Router.** Both shapes coexist in modern Next apps. Extractors tolerate both; do not split into App-only / Pages-only variants.

## How to test changes here

```bash
npx tsc && node build/index.js endpoints -d output/<host> -o /tmp/jsr-endpoints
```

Full acceptance via `run` per root `CLAUDE.md`.

## See also

- `../gen_report/` — output formatter.
- `../../map/next_js/` — produces `mapped.json` consumed by `client_mappedJsonFile.ts`.
