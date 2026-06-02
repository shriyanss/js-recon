# `src/refactor` — deobfuscation / readability pass

## Purpose

Optional pass that rewrites minified chunks into a more readable form for human review. Not wired into the `run` pipeline — invoked manually after `lazyload` when a contributor wants to inspect specific chunks during resolver development.

## Files

- `index.ts` — entrypoint. Dispatches by tech (`next`, `react`).
- `next/index.ts` — Next.js refactor implementation. Walks the AST, normalizes identifier names where possible, runs Prettier on the output, writes to a sibling directory in `output/`.
- `react/index.ts` — React refactor implementation. Same webpack-5 module-function shape (detects `(module, exports, require)` by positional params, rewrites `require(<n>)` calls to `require("./<n>.js")`), plus an exports walk that recognises both `Object.defineProperty(<exports>, "k", { get: () => local })` and the runtime helper `<require>.d(<exports>, { k: () => local, ... })`. Emits ES `export { local as k }` / `export default local` so a reader can see the public surface of each chunk.

## Patterns / gotchas

- **Per-tech subdirs.** Each tech keeps its own AST pass under `<tech>/`; do NOT merge them. Webpack module wrappers are shared in shape, but each framework adds extras (Next.js runtime helpers, React refresh runtime, …).
- **Prettier is required.** Without formatting, the AST-normalized output is harder to read than the original minified code. Don't make Prettier optional.
- **Output goes to a sibling dir** (e.g. `output/<host>/static/js-refactored/`) — never overwrite the source chunks, downstream steps (`map`, `analyze`) still need them.
- **Lossy.** Identifier renaming can produce collisions; the exports walk can collapse multi-getter shapes; refactored code is for human inspection only, never feed it back into `map`.

## How to test changes here

```bash
npx tsc && node build/index.js refactor -m output/<host>/mapped.json -t <next|react> -o /tmp/refactored
```

Spot-check the refactored output by hand.

## See also

- `../map/next_js/` — the place that benefits from refactored chunks during resolver development.
