# `src/lazyLoad/nuxt_js` — Nuxt chunk crawler

## Purpose

Discovers and downloads Nuxt JS chunks. Nuxt 3 emits chunks under `/_nuxt/` with a hashed manifest accessible via `__NUXT__` globals or the rendered page's inline JSON.

## Files

- `nuxt_getFromPageSource.ts` — extracts `<script>` references and the `__NUXT__` payload from the rendered HTML.
- `nuxt_astParse.ts` — parses chunks to enumerate `import()` calls and the build manifest entries.
- `nuxt_stringAnalysisJSFiles.ts` — string-scan fallback for hardcoded chunk URLs.

## Patterns / gotchas

- **Pipeline stops after lazyload.** Same as Angular — Nuxt is detected but downstream `map`/`analyze` are not wired. Don't add downstream assumptions here.
- **Nuxt 2 vs 3 differ.** The manifest shape and globals are different. Detection in `../techDetect/checkNuxtJS.ts` lumps them; the parser here tolerates both — preserve that.
- **`__NUXT__` payload can include sensitive server state** (request/response data inlined for hydration). The crawler captures it; downstream tools must NOT log its contents per the security policy in root `CLAUDE.md`.
- **Research mode** (`--research`) is recorded directly in `../index.ts`'s Nuxt branch, keyed by `nuxt_getFromPageSource`, `nuxt_stringAnalysisJSFiles`, `nuxt_astParse`, and `nuxt_getBuildsManifest` — see `../CLAUDE.md`.

## How to test changes here

```bash
npx tsc && node build/index.js lazyload -u <nuxt-target> -y
```

## See also

- `../techDetect/checkNuxtJS.ts`
