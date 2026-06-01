# `src/run` — pipeline orchestrator

## Purpose

Powers the `run` subcommand — the primary user interface. Sequences `lazyload → strings → map → endpoints → analyze → report` per target. Branches on `globalsUtil.getTech()`: Next.js gets the full 8-step flow (with two extra lazyload re-passes for dynamic chunks); Vue gets the 4-step flow. Other techs are stopped after lazyload with a warning.

## Files

- `index.ts` — single file. Exports `run(cmd)` and `processUrl(url, cmd)`. The flag-to-global wiring lives upstream in `src/index.ts`; this file consumes the resolved `cmd` and threads it into each step.

## Patterns / gotchas

- **CDN dir detection.** `getCdnDir` inspects whether downloaded JS came from a different host than the target. If so, the `map` step is pointed at the CDN's `output/<cdn-host>/...` dir, not the target's. Touching the dir-resolution logic risks the map step running against zero chunks.
- **Batch vs single mode.** When `-u` is a file, each URL gets its own `output/<host>/` and `clearJsUrls()` / `clearJsonUrls()` reset between targets. Forgetting to reset state mid-pipeline causes the next URL to inherit the previous URL's chunk list.
- **`-r/--rules` is forwarded** to both Next and Vue branches as `cmd.rules || ""`. Empty string = use cached rules; non-empty = file/dir override.
- **Step ordering is meaningful.** Strings pass 2 runs after the subsequent-requests re-crawl because it needs the expanded chunk set; swapping them produces stale `extracted_urls.txt`. The Vue branch skips the re-passes entirely — Vite chunk discovery completes in one pass.
- **Vue endpoints fallback.** Vue has no endpoints extractor yet, so `report` step writes `endpoints.json` as `[]` if missing. Don't add a placeholder Vue endpoints implementation here — it belongs in `../endpoints/`.

## Adding a new step or flag

See root `CLAUDE.md` § "Adding a new flag to `run`". Short version: declare the option in `src/index.ts`, set a global in the action handler if it's cross-cutting, otherwise thread through `cmd` — `processUrl` receives the full object.

## How to test changes here

Run end-to-end against a real target as per root `CLAUDE.md`:

```bash
npm run cleanup && npm run start -- run -u <target> -y -k
```

There is no faster iteration loop for this dir — orchestration changes need the full pipeline to validate.

## See also

- Root `CLAUDE.md` § "`run` pipeline in detail" for the step list.
- `../utility/globals.ts` for the state this dir reads/writes between steps.
