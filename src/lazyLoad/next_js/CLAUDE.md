# `src/lazyLoad/next_js` — Next.js chunk crawler

## Purpose

Discovers and downloads Next.js JS chunks. Handles initial script-tag scrape, build manifest resolution, webpack chunk discovery, layout JS parsing, and the multi-pass subsequent-request crawl that picks up dynamically loaded chunks for routes discovered post-first-page.

## Files

- `NextJsCrawler.ts` — top-level crawler. Coordinates the helpers below for the initial pass.
- `next_GetJSScript.ts` — extracts `<script>` tag srcs from the rendered HTML.
- `next_GetLazyResourcesBuildManifestJs.ts` — parses the `_buildManifest.js` to enumerate chunk URLs.
- `next_GetLazyResourcesWebpackJs.ts` — loads the page via Puppeteer, then scans ALL captured JS files (not just webpack-named ones) for webpack chunk URL builder functions (e.g. `__webpack_require__.u`). Shows matching function source, asks user to approve/deny per function (auto-approves with `--yes`), executes approved functions to enumerate chunk URLs. Covers module federation entry points and other non-standard filenames.
- `next_buildId.ts` — extracts the Next.js `buildId` (used to construct chunk paths under `/_next/static/<buildId>/`).
- `next_getClientSidePaths.ts` — walks downloaded chunks for client-side route declarations; feeds the subsequent-requests crawl.
- `next_parseLayoutJs.ts` — Next 13+ App Router: parses layout JS to enumerate nested route dependencies.
- `next_SubsequentRequests.ts` / `next_scriptTagsSubsequentRequests.ts` — the two re-pass strategies (network-based + script-tag-based) for dynamic chunks.
- `next_promiseResolve.ts` — resolves promise-chained chunk loads (webpack's `__webpack_require__.e`).
- `next_bruteForceJsFiles.ts` — fallback brute-force discovery when manifest parsing fails.
- `next_globals.ts` — per-target state (buildId, manifest paths) — local to this crawler, separate from `../globals.ts`.

## Patterns / gotchas

- **Page visit cap.** `NextJsCrawler` accepts `maxPageVisits` (default `0` = unlimited). When set, the `pageQueue` loop in `recursivePass` breaks after `totalPagesVisited` reaches the cap and logs a warning. This prevents memory exhaustion on event-heavy sites where every visited page surfaces 10-20 more links. Exposed as `--max-pages` on `lazyload` and `run`.
- **Content-entropy deduplication.** `NextJsCrawler` uses `pageScriptFingerprints: Map<string, Set<string>>` (keyed by `normalizePageUrl` — origin+pathname) instead of a simple visited set. Before processing a page, its script tags are extracted and fingerprinted (sorted, joined). If the fingerprint matches one already recorded for that pathname, the page is skipped — it has the same JS content as a previously-visited variant. If the fingerprint is new (e.g. a genuinely distinct dynamic route), the page is crawled and its fingerprint added. This correctly handles same-path pages with different query params: variants that differ only in a filter or language selector and load identical scripts are coalesced; parameterized pages (e.g. different product or user IDs) that load distinct chunks are all visited.
- **Script-fingerprint dedup in `next_scriptTagsSubsequentRequests.ts`.** Instead of a pathname-only filter, each endpoint is fetched, its script set is fingerprinted, and duplicates are skipped. `next_SubsequentRequests.ts` (RSC pass) keeps pathname dedup — RSC responses are not HTML.
- **Two re-pass strategies coexist.** Some Next apps expose chunks via runtime network calls, others via injected script tags. Both run; results are unioned. Removing one breaks targets that rely on it.
- **`buildId` is fetched once per target.** If absent, the entire crawl degrades — guard new code paths with a `buildId` presence check.
- **App Router vs Pages Router.** `next_parseLayoutJs` is App-Router-only. Pages Router has its own pathing inferred from the manifest. Don't unify.
- **Brute-force is last resort.** `next_bruteForceJsFiles` makes many requests; only kicks in when manifest parsing returns empty. If it's running on a healthy target, manifest parsing has silently failed — fix that, don't tune the brute-force.

## How to test changes here

```bash
npx tsc && node build/index.js lazyload -u <next-target> -y
ls output/<host>/_next/static/chunks   # confirm chunks downloaded
```

Full acceptance via `run` per root `CLAUDE.md`.

## See also

- `../techDetect/checkNextJS.ts` — sets the tech string that dispatches here.
- `../../map/next_js/` — primary consumer of these chunks.
