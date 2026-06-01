# `src/fingerprint` — bulk framework detection

## Purpose

Powers the `fingerprint` subcommand. Given a list of URLs, classifies each by front-end framework (Next.js, Nuxt, Vue, React, Svelte, Angular). Reuses `lazyLoad/techDetect/` but skips downloading chunks — only the markers needed for classification are fetched.

## Files

- `index.ts` — single file. Takes a URL or URL-file, fans out per-target detection in parallel with a progress bar, emits results as text / csv / json / jsonl.

## Patterns / gotchas

- **Pure read-only.** Does not download chunks, does not write to `output/`. Adding chunk capture here would duplicate `lazyLoad` — keep the boundary.
- **Reuses `lazyLoad/techDetect`.** Any new framework detection logic goes there, NOT here. This dir just adds output formatting + parallelism.
- **No tech-string global side effect.** Unlike `lazyLoad`, this dir does NOT call `setTech()`; it returns per-URL results. Running `fingerprint` then `analyze` in the same process would leak state — `processUrl` in `../run/` handles isolation, but ad-hoc combinations don't.
- **Parallelism is per-URL.** Each URL detection runs independently; no shared Puppeteer page. Concurrency limit is hardcoded — adjust there if memory or rate-limit issues appear.

## How to test changes here

```bash
npx tsc && node build/index.js fingerprint -u urls.txt -f jsonl
```

Compare output across formats; verify that adding a framework to `techDetect` shows up here too.

## See also

- `../lazyLoad/techDetect/` — the actual detection logic.
