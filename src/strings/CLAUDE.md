# `src/strings` — string extraction & URL permutation

## Purpose

Powers the `strings` subcommand and pipeline steps 2, 4, and 4.6 (Next.js). Walks every downloaded chunk with `@babel/parser` and extracts string and template literals. Secondary outputs: secrets scan, URL permutation set, OpenAPI-shaped path inventory.

## Files

- `index.ts` — entrypoint. Extracts strings from each chunk, deduplicates, writes `extracted_urls.json` / `extracted_urls.txt` / `extracted_urls-openapi.json`.
- `secrets.ts` — regex-based secret detection. Runs only when `--secrets` is set on `run` or the `strings` subcommand. Patterns intentionally noisy — secret findings flow into `analyze.json` for filtering, not directly to the report.
- `permutate.ts` — generates URL mutations (path slashes, trailing variants) from extracted literals. Output feeds the next lazyload re-pass — small permutation explosions here cascade into many extra HTTP requests.
- `openapi.ts` — re-shapes path inventory into the OpenAPI-compatible JSON used downstream.

## Patterns / gotchas

- **WeakSet for circular refs.** AST walks use a WeakSet to break cycles. Removing it has caused stack overflows on large minified chunks in the past — leave it in.
- **Template literals are flattened** to string concatenation with `${...}` markers preserved. Downstream resolvers (`map/`) parse those markers; changing the marker shape breaks resolution.
- **Two passes is intentional.** First pass runs against the initial lazyload output; second pass runs after subsequent-requests crawl picks up dynamic chunks. The two outputs are merged — single-pass changes silently drop dynamic chunks' strings.
- **Prettier on output:** the JSON is pretty-printed for human review. Don't switch to `JSON.stringify(..., 0)` for "performance" — file is read by humans during target review.

## How to test changes here

```bash
npx tsc && node build/index.js strings -d output/<host>/static/js -o /tmp/jsr-strings
```

Full acceptance via `run` per root `CLAUDE.md`.

## See also

- `../lazyLoad/` — produces the chunks consumed here.
- `../map/` — consumes the `extracted_urls-openapi.json` shape for cross-referencing.
