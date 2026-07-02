# `src/lazyLoad/techDetect` — framework fingerprinting

## Purpose

Identifies which front-end framework a target uses. Single entrypoint, one check file per framework. Result sets the global tech string consumed by `run` to dispatch the per-framework pipeline. Reused by `../../fingerprint/` for bulk classification.

## Files

- `index.ts` — orchestrator. Runs each `check*` function and returns the first match (with order chosen to disambiguate overlapping signals).
- `checkNextJS.ts` — `__NEXT_DATA__`, `_next/static`, App-Router-specific markers.
- `checkNuxtJS.ts` — `__NUXT__`, `/_nuxt/` paths, Nuxt-specific data-attrs.
- `checkVueJS.ts` — `data-v-*` attrs, Vue devtools globals.
- `checkReact.ts` — webpack manifest shape, React-specific runtime hooks.
- `checkSvelte.ts` — Svelte hydration markers, `_app/immutable/` paths.
- `checkAngularJS.ts` — `ng-version` attr, Angular runtime globals.

## Patterns / gotchas

- **Order matters.** Nuxt MUST be checked before Vue (a Nuxt site is also a Vue site). Same for SvelteKit-before-Svelte if that distinction is ever needed. Re-ordering checks silently mislabels frameworks.
- **Each check is permissive.** Returning a positive on the FIRST strong signal is the convention; don't add multi-signal AND-logic without considering false negatives.
- **Both Puppeteer page AND raw fetch** are available — the orchestrator passes both so checks can use whichever is cheaper. Don't force a check to use Puppeteer when a static HTML scan suffices.
- **Empty return = unknown.** `run` exits when tech is empty; do NOT default to a guess for stability — silent misdispatch is worse than aborting.
- **Network request interception fallback.** `index.ts` enables Puppeteer request interception and collects all URLs requested during page load. If all HTML-attribute checks fail, the orchestrator scans the intercepted URL list for framework-specific path prefixes (`/_nuxt/`, `/_next/`). This catches sites that load framework chunks dynamically (e.g. behind a redirect or Cloudflare challenge) rather than referencing them in static HTML. The fallback runs only when all `check*` functions return negative — it does not change behavior for normally-detectable sites.
- **Request interceptor must abort non-http/s schemes.** The interceptor calls `req.continue()` only for `http://` and `https://` requests; all other schemes (`mailto:`, `data:`, `blob:`, `chrome-extension:`, `tel:`) are aborted. Calling `continue()` on non-http/s requests throws an unhandled error and may invoke OS protocol handlers. See the Puppeteer robustness rules in `../CLAUDE.md` for the full pattern.
- **File downloads are denied via CDP.** `Page.setDownloadBehavior({ behavior: "deny" })` is sent immediately after page creation. Detection pages may contain download-triggering links; allowing downloads would block the browser and pollute the working directory.
- **Adding a framework** = new `checkX.ts` here + new crawler in `../<framework>/` + new branch in `../../map/index.ts` + (optionally) downstream wiring. Without all four, the framework is detected but unsupported.

## How to test changes here

```bash
npx tsc && node build/index.js fingerprint -u urls.txt -f json
```

`fingerprint` exercises this dir without downloading chunks — the fastest verification loop.

## See also

- `../index.ts` — the consumer that dispatches based on tech string.
- `../../fingerprint/` — bulk consumer.
