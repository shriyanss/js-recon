# `src/lazyLoad` — JS chunk discovery & download

## Purpose

Powers the `lazyload` subcommand and pipeline step 1 (every framework). Visits the target with Puppeteer, runs tech detection, then dispatches to a per-framework crawler that discovers chunk URLs from script tags, manifests, build IDs, and string scans. Downloads everything into `output/<host>/...`.

## Files

- `index.ts` — entrypoint. Boots Puppeteer (via `utility/puppeteerInstance`), calls `techDetect/`, sets the global tech string, then dispatches to a framework crawler. Handles single-URL and subsequent-request re-passes.
- `downloadQueue.ts` — concurrency-controlled download queue used by every framework crawler. Retries, rate limits, and dedupes by URL.
- `downloadFilesUtil.ts` — writes downloaded files to `output/<host>/<path>` preserving server paths; canonicalizes querystrings.
- `downloadLoadedJsUtil.ts` — pulls JS already loaded into a Puppeteer page (used when crawlers can't infer chunk URLs statically).
- `sourcemap.ts` — fetches `.map` files alongside JS and reconstructs original sources where present.
- `globals.ts` — `jsUrls`, `jsonUrls` sets; `clearJsUrls()` / `clearJsonUrls()` called between batch targets.
- `techDetect/` — framework fingerprinting. See `techDetect/CLAUDE.md`.
- `next_js/`, `vue/`, `react/`, `svelte/`, `angular/`, `nuxt_js/` — per-framework crawlers. Each implements its own chunk-discovery pattern; see the subdir CLAUDE.md.

## Patterns / gotchas

- **Tech detection is gated:** if `techDetect` returns an empty string, `run` aborts. Adding a new framework requires both a `checkX.ts` in `techDetect/` AND a crawler dir here — neither alone is enough.
- **Sourcemap fetch is best-effort.** Failure is silent (logged but not raised); the pipeline keeps running on minified code. Don't add hard failures on sourcemap errors.
- **Global URL sets are mutable singletons.** Inserting a URL from a framework crawler is fire-and-forget — anything reading the set must accept it grows. `clearJsUrls()` is the only safe way to reset.
- **Subsequent-request re-passes** (Next.js step 3 and step 4.5 in `run`) reuse this dir but enter through specific crawler functions, not `index.ts`. Adding a new crawler function intended for re-passes means wiring it explicitly in `run/index.ts`.
- **Hard timeout (`hardTimeoutMs` param):** the entire crawl body is wrapped in `Promise.race()` against a `setTimeout`. When the timer fires, the Next.js crawler's `stop()` flag is set (halting further recursive passes) and `activeQueue.drain()` is awaited so all already-discovered files are downloaded before the pipeline continues. Other framework queues are also drained on timeout. Pass `0` to disable the timeout entirely.
- **Puppeteer singleton:** see `../utility/puppeteerInstance.ts`. Multiple concurrent `lazyLoad` calls share one browser; closing it mid-pipeline breaks downstream re-passes.

## How to test changes here

`lazyload` is the slowest step. Iterate by hand with a specific URL and inspect `output/<host>/`:

```bash
npx tsc && node build/index.js lazyload -u <target> -y
```

Use `-y` to skip the legal prompt. Final acceptance via the full `run` pipeline per root `CLAUDE.md`.

## See also

- `../utility/puppeteerInstance.ts`
- `../fingerprint/` — uses `techDetect/` standalone for bulk URL classification.
