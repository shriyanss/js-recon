# `src/load` — external request-history import

## Purpose

Imports HTTP request logs from external proxies (currently Caido) and seeds the global request store so that downstream analysis (especially `analyze`'s request engine) can match against real traffic, not just the resolved endpoint list.

## Files

- `index.ts` — single file. Streams the input file (Caido export JSON), decompresses entries as needed, filters by scope, and pushes parsed requests into `utility/globals.ts`'s request store.

## Patterns / gotchas

- **Streaming parser.** Caido exports can be hundreds of MB; this file reads in fixed-size chunks (~1024KB) and parses incrementally. Don't switch to `JSON.parse(fs.readFileSync(...))` — it OOMs on real exports.
- **Default ports are hardcoded.** HTTPS=443, HTTP=80. If a Caido export contains a non-default port without explicit annotation, it's preserved verbatim — don't silently strip ports.
- **Stores into globals.** No file output; downstream tools read from `utility/globals` only. Running `load` then `analyze` is the canonical order.
- **Caido-shape only today.** Adding Burp or another tool means a separate parser + a format flag, not a generalization of the Caido parser.

## How to test changes here

```bash
npx tsc && node build/index.js load -i caido-export.json
node build/index.js analyze ...   # confirm requests are visible
```

## See also

- `../analyze/engine/requestEngine.ts` — primary consumer.
- `../utility/globals.ts` — store location.
