# `src/endpoints/gen_report` — endpoints output formatter

## Purpose

Takes the union of client-side routes produced by `../next_js/` (and future framework extractors) and writes the canonical `endpoints.json`. This is the contract `../../report/`'s populator depends on — schema changes here must be reflected there.

## Files

- `gen_json.ts` — writes `endpoints.json`. One record per route with the agreed schema (path, method when known, source chunk, dynamic-segment metadata).
- `utility/` — small helpers (path normalization, dedup keys).

## Patterns / gotchas

- **Schema is the contract.** Any new field must be added in `report/utility/initReportDb.ts`, the matching populator, AND any framework extractor producing it. Adding a field here alone silently drops it downstream.
- **Dedup by canonicalized path.** Trailing slash, query strings, and dynamic-segment normalization are settled here — don't dedup in framework extractors too.
- **No HTML/markdown rendering.** This dir produces JSON only; presentation belongs in `report/`.

## How to test changes here

Inspect `endpoints.json` shape after running `endpoints` against a downloaded target. Full acceptance via `run` per root `CLAUDE.md`.

## See also

- `../next_js/` — current source of records.
- `../../report/utility/populateDb/` — primary consumer.
