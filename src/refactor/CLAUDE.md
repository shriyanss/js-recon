# `src/refactor` — deobfuscation / readability pass

## Purpose

Optional pass that rewrites minified chunks into a more readable form for human review. Not wired into the `run` pipeline — invoked manually after `lazyload` when a contributor wants to inspect specific chunks during resolver development.

## Files

- `index.ts` — entrypoint. Dispatches by tech.
- `next/index.ts` — Next.js refactor implementation. Walks the AST, normalizes identifier names where possible, runs Prettier on the output, writes to a sibling directory in `output/`.

## Patterns / gotchas

- **Next-only today.** Adding Vue/React means a parallel subdir; do NOT merge into `next/`.
- **Prettier is required.** Without formatting, the AST-normalized output is harder to read than the original minified code. Don't make Prettier optional.
- **Output goes to a sibling dir** (e.g. `output/<host>/static/js-refactored/`) — never overwrite the source chunks, downstream steps (`map`, `analyze`) still need them.
- **Lossy.** Identifier renaming can produce collisions; refactored code is for human inspection only, never feed it back into `map`.

## How to test changes here

```bash
npx tsc && node build/index.js refactor -d output/<host>/static/js
```

Spot-check the refactored output by hand.

## See also

- `../map/next_js/` — the place that benefits from refactored chunks during resolver development.
