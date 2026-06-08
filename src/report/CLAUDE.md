# `src/report` — SQLite + HTML report generator

## Purpose

Powers the `report` subcommand and the final step of every `run` pipeline. Reads `mapped.json`, `mapped-openapi.json`, `endpoints.json`, `analyze.json`, and `extracted_urls*.json`, populates `js-recon.db` (SQLite), and renders `report.html`.

## Files

- `index.ts` — entrypoint. Wires together DB init, populate functions, HTML generation. Tolerant of missing inputs (Vue's missing endpoints.json is the canonical case).
- `utility/initReportDb.ts` — SQLite schema source of truth. Any new column or table must be added here, then in the matching `populateDb/` script, then in `genHtml.ts` to display it.
- `utility/populateDb/` — one populator per input file type. Each reads its input JSON and INSERTs into the DB.
- `utility/genHtml.ts` — top-level HTML render.
- `utility/dataTables/` — per-table JS/HTML scaffolding for interactive DataTables in the report.
- `utility/markdownGen/` — markdown rendering for finding bodies (analyze rule output).

## Patterns / gotchas

- **Idempotency:** running `report` twice against the same dir REPLACES `js-recon.db`. Don't add INSERT-OR-IGNORE — full replace is the contract.
- **Missing input tolerance.** If `endpoints.json` doesn't exist, the report still renders. Adding a new required input means deciding the fallback explicitly in `index.ts`.
- **Schema migrations:** none. Schema is rebuilt every run, so column changes don't need versioning, but they DO need updating all three: schema, populator, renderer.
- **HTML output is a single file.** All JS/CSS is inlined. Don't introduce external script references — the report needs to work from a file:// URL.

## How to test changes here

```bash
npx tsc && node build/index.js report -d output/<host>
```

Open `report.html` in a browser. Full acceptance via `run` per root `CLAUDE.md`.

## See also

- `../analyze/` — produces `analyze.json`.
- `../map/` — produces `mapped.json`.
