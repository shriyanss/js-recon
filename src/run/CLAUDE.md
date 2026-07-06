# `src/run` — pipeline orchestrator

## Purpose

Powers the `run` subcommand — the primary user interface. Sequences `lazyload → strings → map → endpoints → analyze → report` per target. Branches on `globalsUtil.getTech()`: Next.js gets the full 8-step flow (with two extra lazyload re-passes for dynamic chunks); Vue, React, Nuxt, Svelte, and Angular get the 4-step flow. Other techs are stopped after lazyload with a warning.

## Files

- `index.ts` — single file. Exports `run(cmd)` and `processUrl(url, cmd)`. The flag-to-global wiring lives upstream in `src/index.ts`; this file consumes the resolved `cmd` and threads it into each step.
- `interruptHandler.ts` — SIGINT (Ctrl-C) handler. Installs a persistent `process.on('SIGINT')` listener while `run` is active. On interrupt, prints a menu and reads one line from stdin. Exposes `getSkipStepPromise()` (each step in `processUrl` is wrapped in `Promise.race([step, getSkipStepPromise()])` so choosing "skip step" causes the pipeline to advance without waiting for the current step to finish) and `shouldSkipTarget()` (checked between steps; returning early from `processUrl` skips the remaining steps for the current target). In batch mode, `resetSkipTarget()` is called before each target.
- `bundler-detect.ts` — CS-MAST-S bundler detection. Exports `detectBundler(mappedJsonPath, framework, threshold)`. Samples `collisions.json` files from the HuggingFace `shriyanss/cs-mast-s-dataset` bucket for each candidate tech (e.g. `react-webpack`, `react-vite`), counts how many sampled library signatures appear in the bundle's CS-MAST signature set, and returns the best-matching tech identifier if the match count meets the threshold. Uses the same list cache and signature cache as the `refactor` module. Currently only React bundles have bucket entries; other frameworks gracefully return null.

## Refactor integration

After the report step, each supported framework branch (React, Vue, Nuxt, Next.js) runs an optional refactor pass:

1. **Bundler detection** (`detectBundler`) — samples 15 random `collisions.json` files from the HF bucket for each candidate tech, generates CS-MAST-S signatures from the mapped bundle, and counts matches.
2. **Conditional refactor** — if matches ≥ `--cs-mast-tech-detect-threshold` (default 50), calls `refactor(mappedJson, refactorOutputDir, detectedTech, false)`. The output lands in `refactored/` (single-mode) or `<workingDir>/refactored/` (batch mode); any existing directory is deleted first.
3. **Skip path** — if no signatures exist for the framework in the bucket (currently: Vue, Nuxt, Next.js), or if the match count is below threshold, a yellow warning is printed and the refactor step is skipped silently. The overall pipeline still reports success.

These steps use `[*]` as their step prefix to signal they are optional addenda; the existing numbered step counters (`[2/4]`, etc.) are unchanged.

**New flag:** `--cs-mast-tech-detect-threshold <n>` (default `50`) — minimum CS-MAST-S signature matches to consider a bundler detected. Pass `0` to always skip refactor.

## Patterns / gotchas

- **CDN dir detection.** `getCdnDir` inspects whether downloaded JS came from a different host than the target. If so, the `map` step is pointed at the CDN's `output/<cdn-host>/...` dir, not the target's. Touching the dir-resolution logic risks the map step running against zero chunks.
- **Batch vs single mode.** When `-u` is a file, each URL gets its own `output/<host>/` and `clearJsUrls()` / `clearJsonUrls()` reset between targets. Forgetting to reset state mid-pipeline causes the next URL to inherit the previous URL's chunk list.
- **`-r/--rules` is forwarded** to both Next and Vue branches as `cmd.rules || ""`. Empty string = use cached rules; non-empty = file/dir override.
- **Step ordering is meaningful.** Strings pass 2 runs after the subsequent-requests re-crawl because it needs the expanded chunk set; swapping them produces stale `extracted_urls.txt`. The Vue branch skips the re-passes entirely — Vite chunk discovery completes in one pass.
- **Vue/Angular endpoints fallback.** Vue and Angular have no endpoints extractor yet, so the `report` step writes `endpoints.json` as `[]` if missing. Don't add a placeholder implementation here — it belongs in `../endpoints/`.
- **`process.exit(0)` in finally.** The `run` action handler's `finally` block calls `process.exit(0)` after `removeSigintHandler()`. This is intentional: Puppeteer navigations abandoned by the lazyload hard timeout keep the Node.js event loop open indefinitely, preventing natural exit. Any step that encounters an unrecoverable error calls `process.exit(N)` directly (e.g. exit 10 for tech not detected), which terminates the process before the finally block runs, so the explicit `process.exit(0)` only fires on a successful or normally-returned pipeline.
- **`--max-heap` re-exec.** `applyHeapLimit()` (`src/utility/heap.ts`) is called only when the user explicitly supplies `--max-heap`; the flag has no default, so omitting it leaves the existing V8 heap limit (set by `--max-old-space-size=8192` in `npm run start`) unchanged. When supplied, if the requested heap differs from the current V8 limit by more than 10%, the entire process re-execs with `--max-old-space-size=<target>`. The env var `JS_RECON_HEAP_SET=1` prevents a second re-exec. Because re-exec happens before `processUrl` is called, all pipeline steps — including the heap-intensive `map` step — run under the correct limit. `--max-heap 0` means "all available RAM" (`os.totalmem()`).
- **`--include-methods` / `--exclude-methods` / `--list-methods`.** Parsed and validated in `src/index.ts` `run` action handler (same code path as `lazyload`). Stored on `cmd._includeMethods` / `cmd._excludeMethods` as parsed `string[]` (not the raw comma-joined string). Passed to `processUrl()` as explicit parameters and forwarded to all three `lazyLoad()` calls (initial, subsequent-requests step 3, re-pass step 4.5). The `-u` option on `run` was changed from `requiredOption` to `option` so that `--list-methods` can exit before commander's required-field check would fire.

## Adding a new step or flag

See root `CLAUDE.md` § "Adding a new flag to `run`". Short version: declare the option in `src/index.ts`, set a global in the action handler if it's cross-cutting, otherwise thread through `cmd` — `processUrl` receives the full object.

When adding a new step to `processUrl`, wrap its `await` call using the interrupt pattern so Ctrl-C works correctly:

```typescript
resetSkipStep();
await Promise.race([newStep(...), getSkipStepPromise()]);
if (shouldSkipTarget()) return;
```

## How to test changes here

Run end-to-end against a real target as per root `CLAUDE.md`:

```bash
npm run cleanup && npm run start -- run -u <target> -y -k
```

There is no faster iteration loop for this dir — orchestration changes need the full pipeline to validate.

## See also

- Root `CLAUDE.md` § "`run` pipeline in detail" for the step list.
- `../utility/globals.ts` for the state this dir reads/writes between steps.
