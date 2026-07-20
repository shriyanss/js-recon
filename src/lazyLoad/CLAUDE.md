# `src/lazyLoad` — JS chunk discovery & download

## Purpose

Powers the `lazyload` subcommand and pipeline step 1 (every framework). Visits the target with Puppeteer, runs tech detection, then dispatches to a per-framework crawler that discovers chunk URLs from script tags, manifests, build IDs, and string scans. Downloads everything into `output/<host>/...`.

## Files

- `index.ts` — entrypoint. Boots Puppeteer (via `utility/puppeteerInstance`), calls `techDetect/`, sets the global tech string, then dispatches to a framework crawler. Handles single-URL and subsequent-request re-passes.
- `downloadQueue.ts` — concurrency-controlled download queue used by every framework crawler. Retries, rate limits, and dedupes by URL.
- `downloadFilesUtil.ts` — writes downloaded files to `output/<host>/<path>` preserving server paths; canonicalizes querystrings.
- `sourcemap.ts` — fetches `.map` files alongside JS and reconstructs original sources where present.
- `globals.ts` — `jsUrls`, `jsonUrls` sets; `clearJsUrls()` / `clearJsonUrls()` called between batch targets.
- `techDetect/` — framework fingerprinting. See `techDetect/CLAUDE.md`.
- `next_js/`, `vue/`, `react/`, `svelte/`, `angular/`, `nuxt_js/` — per-framework crawlers. Each implements its own chunk-discovery pattern; see the subdir CLAUDE.md.
- `generic/` — fallback crawler used when `techDetect/` returns no match. Not a real framework: `generic_getScriptTags.ts` seeds from `<script src>`/inline scripts/`<link rel="modulepreload">` (same pattern as `react_getScriptTags.ts`); `generic_scanAttributesForJs.ts` additionally walks every HTML attribute value, resolves it with the `URL` constructor, and — for any URL with a path segment ending in `.js` (catches cachebuster-suffixed paths like `.../beacon.min.js/v124/token` that don't end in `.js`) — confirms it's actually JavaScript via a HEAD/GET `Content-Type` check (`generic_jsMimeTypes.ts`) rather than trusting the extension alone. `generic_downloadFiles.ts` is a dedicated writer (not `downloadFilesUtil.ts`/`DownloadQueue`) because those derive the on-disk filename from an end-anchored match against the URL's last path segment, which fails for the same cachebuster shape.

## Research mode (`--research`)

`--research`/`--research-output <file>` instruments the discovery techniques used during a crawl. Enabled, it writes a `Record<string, string[]>` (technique name → discovered URLs, not deduplicated across techniques — the same URL can legitimately appear under more than one technique since this measures each technique's individual yield) to the research output file. Technique-name keys are meant to match the corresponding framework's entry in `FRAMEWORK_METHODS` (`methodFilter.ts`), so `--include-methods`/`--exclude-methods` and `--research` stay cross-referenceable.

- **Next.js** is implemented inside `next_js/NextJsCrawler.ts` via the `public techniqueEfficiencyMapping` field, written out by `index.ts` only in the `tech.name === "next"` branch. Its key names have some legacy casing drift against `FRAMEWORK_METHODS.next_js` (e.g. `next_getJSScript` vs `next_GetJSScript`) — this is a known pre-existing inconsistency, left as-is.
- **Vue, Nuxt, Svelte, Angular, React** build a local `Record<string, string[]>` directly in `index.ts`'s per-framework branch using `accumulateTechnique()` from `researchUtils.ts`, then write it out the same way as Next.js once the branch's queue drains. Because each of these frameworks calls `lazyLoad()` exactly once per target (no Next.js-style re-passes), there's no overwrite risk across multiple lazyload invocations.
- **Vue is the one exception needing extra plumbing**: its top-level `index.ts` branch only calls `vue_discoverJsFiles`/`vue_recursiveClientSidePathDownload`, but the actual per-technique granularity (page-source scan, runtime.js, single/several-JS-on-home, viteMapDeps, jsImports, stringJsFiles, reconstructSourceMaps, getClientSidePaths) lives _inside_ `vue_discoverJsFiles`. Both functions accept an optional trailing `onTechnique?: TechniqueRecorder` callback (from `researchUtils.ts`) that fires at each internal `emit()` site, including during path recursion, so research recording still attributes each URL to the specific technique that found it rather than lumping everything under `vue_discoverJsFiles`.

## Patterns / gotchas

- **Tech detection no longer aborts.** When `techDetect/` returns no match (`null`), `index.ts` no longer sets the tech string to `""` — it runs the `generic/` crawler and sets tech to `"generic"`. `run`'s exit code 10 ("Technology not detected") now only fires if the crawl throws before reaching that fallback, not on ordinary detection failure. Adding a new _real_ framework still requires both a `checkX.ts` in `techDetect/` AND a crawler dir here — neither alone is enough.
- **Sourcemap fetch is best-effort.** Failure is silent (logged but not raised); the pipeline keeps running on minified code. Don't add hard failures on sourcemap errors.
- **Global URL sets are mutable singletons.** Inserting a URL from a framework crawler is fire-and-forget — anything reading the set must accept it grows. `clearJsUrls()` is the only safe way to reset.
- **Subsequent-request re-passes** (Next.js step 3 and step 4.5 in `run`) reuse this dir but enter through specific crawler functions, not `index.ts`. Adding a new crawler function intended for re-passes means wiring it explicitly in `run/index.ts`.
- **Hard timeout (`hardTimeoutMs` param):** the entire crawl body is wrapped in `Promise.race()` against a `setTimeout`. When the timer fires, the Next.js crawler's `stop()` flag is set (halting further recursive passes) and `activeQueue.drain()` is awaited so all already-discovered files are downloaded before the pipeline continues. Other framework queues are also drained on timeout. Pass `0` to disable the timeout entirely. Note: when the timeout fires, any in-progress Puppeteer `page.goto()` calls inside the crawler are abandoned but not aborted — they continue navigating until their own timeout. This keeps the Node.js event loop open after `lazyLoad()` returns; `run/index.ts` calls `process.exit(0)` in its `finally` block to ensure clean process termination.
- **Puppeteer singleton:** see `../utility/puppeteerInstance.ts`. Multiple concurrent `lazyLoad` calls share one browser; closing it mid-pipeline breaks downstream re-passes.

## Puppeteer robustness rules (apply to every new Puppeteer page)

Every module that creates a Puppeteer page MUST follow these four rules. Deviating from any one can cause hangs, crashes, or OS side-effects during a scan:

1. **Use `waitUntil: "networkidle0"` with a timeout on `page.goto()`.** Wrap the call in try/catch and return the partial result on error. Do NOT use `waitUntil: "load"` without a timeout in download utilities — the `load` event may never fire on some SPA patterns or service-worker-heavy sites.

    ```typescript
    try {
        await page.goto(url, { waitUntil: "networkidle0", timeout: 10000 });
    } catch (_) {
        /* use URLs collected so far */
    }
    ```

2. **Wrap `browser.close()` in try/catch; SIGKILL on failure.** Chrome can become stuck after navigating to a site that started a download or a modal dialog. `browser.close()` will hang forever. Force-kill as a fallback:

    ```typescript
    try {
        await browser.close();
    } catch (_) {
        browser.process()?.kill("SIGKILL");
    }
    ```

3. **Abort non-http/s requests in the request interceptor; never call `continue()` on them.** `request.continue()` throws for `mailto:`, `data:`, `blob:`, `chrome-extension:`, `tel:`, and any other non-http scheme. In addition to the error, some schemes invoke OS protocol handlers (mail client, phone app). Always abort first:

    ```typescript
    if (/^https?:\/\//i.test(req.url())) {
        await request.continue();
    } else {
        await request.abort();
    }
    ```

4. **Three-layer OS protocol handler defence.** Non-http links can bypass the request interceptor (e.g. if JavaScript triggers `window.open()` before the page load event). All three layers are required:
    - Pass `--disable-external-protocol-dialog` to Chrome at launch.
    - Install an `evaluateOnNewDocument` guard that overrides `window.open` and prevents non-http/s anchor clicks from reaching the browser's handler dispatch.
    - Abort non-http/s in the request interceptor (rule 3 above).

5. **Deny file downloads via CDP.** Issue `Page.setDownloadBehavior({ behavior: "deny" })` immediately after `page.createCDPSession()`. Download-triggering links on target pages can block the browser indefinitely and fill the output directory with unexpected files:
    ```typescript
    const cdp = await page.createCDPSession();
    await cdp.send("Page.setDownloadBehavior", { behavior: "deny" });
    ```

## How to test changes here

`lazyload` is the slowest step. Iterate by hand with a specific URL and inspect `output/<host>/`:

```bash
npx tsc && node build/index.js lazyload -u <target> -y
```

Use `-y` to skip the legal prompt. Final acceptance via the full `run` pipeline per root `CLAUDE.md`.

## See also

- `../utility/puppeteerInstance.ts`
- `../fingerprint/` — uses `techDetect/` standalone for bulk URL classification.
