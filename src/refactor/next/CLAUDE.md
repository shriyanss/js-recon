# `src/refactor/next` — Next.js chunk refactor

## Purpose

Lightly rewrites a single Next.js webpack chunk to make it more readable during manual inspection. Returns a single string (unlike the React refactor which returns one file per module).

## What it does

`refactorNext(chunk)` applies three transformations:

1. **Require rewrite** — finds the third parameter of the top-level function declaration (the webpack `require` / `__webpack_require__` alias), then replaces every `<thirdParam>(<numericId>)` call with `require("./<numericId>.js")`
2. **Default export** — finds the first exported function in the chunk (identified by `__webpack_exports__` assignments or similar patterns) and appends `export default <functionName>` at the end
3. **Prettier formatting** — the result is passed through Prettier before being written

## Limitations

- Only handles function-form webpack chunks. Script-style entries or arrow-function wrappers may not be picked up.
- Does not split the module map — all code stays in a single file.
- No named export extraction; use the React refactor for bundles that use the numeric module map.

## Output

Returns a `Promise<string>` (single refactored file content). The dispatcher in `../index.ts` writes it to `output_refactored/<chunkId>.js`.
