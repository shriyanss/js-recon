# `src/report` — SQLite + HTML report generator

## Purpose

Powers the `report` subcommand and the final step of every `run` pipeline. Reads `mapped.json`, `mapped-openapi.json`, `endpoints.json`, `analyze.json`, and `extracted_urls*.json`, populates `js-recon.db` (SQLite), and renders `report.html`.

## Files

- `index.ts` — entrypoint. Wires together DB init, populate functions, HTML generation. Tolerant of missing inputs (Vue's missing endpoints.json is the canonical case).
- `utility/initReportDb.ts` — SQLite schema source of truth for the **per-domain** `js-recon.db`. Any new column or table must be added here, then in the matching `populateDb/` script, then in `genHtml.ts` to display it.
- `utility/initGlobalReportDb.ts` — schema for the **batch-wide global** `js-recon.db` written to `<output>/js-recon.db` when `run -u <file>` processes multiple domains. Same tables as `initReportDb.ts` plus a `domain` column on every table, and the affected primary keys widened to `(domain, ...)` (or replaced with an autoincrement `globalId`) since the per-domain values (chunk `id`, `(path, method)`, `url`) aren't unique across domains. Keep in sync with `initReportDb.ts` when the per-domain schema changes.
- `utility/mergeDomainIntoGlobalDb.ts` — copies one domain's fully-populated `js-recon.db` into the global one via `ATTACH DATABASE`, tagging every row with `domain`. Called from `src/run/index.ts`'s batch loop after each target's `report` step finishes.
- `utility/populateDb/` — one populator per input file type. Each reads its input JSON and INSERTs into the DB.
- `utility/genHtml.ts` — top-level HTML render.
- `utility/dataTables/` — per-table JS/HTML scaffolding for interactive DataTables in the report.
- `utility/markdownGen/` — markdown rendering for finding bodies (analyze rule output).

## Patterns / gotchas

- **Idempotency:** running `report` twice against the same dir REPLACES `js-recon.db`. Don't add INSERT-OR-IGNORE — full replace is the contract. This does not apply to the global DB (`initGlobalReportDb.ts`), which accumulates rows from every domain across a batch run rather than being replaced.
- **Missing input tolerance.** If `endpoints.json` doesn't exist, the report still renders. Adding a new required input means deciding the fallback explicitly in `index.ts`.
- **Schema migrations:** none. Schema is rebuilt every run, so column changes don't need versioning, but they DO need updating all three: schema, populator, renderer. When the per-domain schema (`initReportDb.ts`) changes, update `initGlobalReportDb.ts` and `mergeDomainIntoGlobalDb.ts` to match.
- **HTML output is a single file.** All JS/CSS is inlined. Don't introduce external script references — the report needs to work from a file:// URL.

## How to test changes here

```bash
npx tsc && node build/index.js report -d output/<host>
```

Open `report.html` in a browser. Full acceptance via `run` per root `CLAUDE.md`.

## See also

- `../analyze/` — produces `analyze.json`.
- `../map/` — produces `mapped.json`.
