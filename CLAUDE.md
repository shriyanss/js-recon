# js-recon

Static analysis tool that maps API endpoints and detects client-side security issues by analyzing Next.js (webpack/turbopack) and Vue.js bundles. Written in TypeScript, compiled to `build/` before running.

## Build & run

```bash
npm run cleanup   # rm -rf build/ + tsc (full rebuild)
npm run start -- <subcommand> [options]
```

`cleanup` must be run before testing any TypeScript change when using the `run` command.

## Subcommands

| Command | Purpose |
|---------|---------|
| `lazyload` | Download JS chunks from a target URL |
| `strings` | Extract strings/paths/secrets from JS files |
| `map` | Parse webpack/turbopack bundles into a structured `mapped.json` |
| `endpoints` | Extract client-side routes |
| `analyze` | Run YAML rules against `mapped.json` / OpenAPI spec |
| `report` | Generate HTML/SQLite report |
| `run` | Run all of the above in sequence (primary interface) |
| `api-gateway` | Manage AWS API Gateway for IP rotation |
| `mcp` | Interactive AI-powered CLI |

## Key source files

- `src/index.ts` — CLI entry point; all subcommand definitions and option declarations live here
- `src/run/index.ts` — orchestrates the full pipeline (`run` subcommand); two tech-specific flows (Next.js 8-step, Vue 4-step)
- `src/analyze/index.ts` — loads/validates rules, runs AST and request engines
- `src/analyze/helpers/initRules.ts` — downloads/caches rules from GitHub to `~/.js-recon/rules`
- `src/analyze/helpers/validate.ts` — validates rules and checks `js_recon_version` compatibility
- `src/analyze/helpers/schemas.ts` — Zod schema for rule YAML files
- `src/map/next_js/resolveFetch.ts` — resolves `fetch()` calls, detects Next.js framework chunks
- `src/map/next_js/utils.ts` — `resolveNodeValue`, `resolveVariableInChunk`, `substituteVariablesInString`
- `src/map/next_js/getWebpackConnections.ts` — extracts chunk code from webpack bundles
- `src/globalConfig.ts` — current version string and tool-wide constants
- `src/utility/globals.ts` — mutable global state (tech detection result, AI config, OpenAPI flag, etc.)

## `run` pipeline in detail

`run` is the primary subcommand. It calls `processUrl` for each target, which dispatches to one of two pipelines based on the detected front-end framework (`globalsUtil.getTech()`).

### Next.js pipeline (8 steps)

1. **Lazyload** — downloads initial JS chunks via Puppeteer; detects framework; sets `globalsUtil.getTech()` to `"next"`
2. **Strings** — scans downloaded JS for strings, extracts URL paths → `extracted_urls.json`
3. **Lazyload (subsequent requests)** — re-crawls using the extracted paths to fetch dynamically loaded chunks; also fetches `buildId`
4. **Strings (pass 2)** — re-runs strings on the expanded chunk set; generates `extracted_urls.txt` (permuted) and `extracted_urls-openapi.json`; optionally scans secrets (`--secrets`)
5. **Lazyload re-pass (step 4.5)** — a second subsequent-requests crawl to pick up chunks for dynamic routes discovered in pass 2
6. **Strings re-pass (step 4.6)** — strings pass over the re-pass chunks
7. **Map** — parses webpack/turbopack bundles; resolves `fetch()` calls and axios usage; generates `mapped.json` and `mapped-openapi.json`; CDN-aware: if JS was served from a different host, `getCdnDir` finds the CDN output dir and passes that to map instead of `outputDir/host`
8. **Endpoints** — extracts client-side route paths; uses `___subsequent_requests` directory presence to decide whether to pass a JS directory
9. **Analyze** — loads YAML rules (from `-r/--rules` if provided, otherwise default rules cache); runs AST engine and request engine; writes `analyze.json`
10. **Report** — populates SQLite DB (`js-recon.db`) and generates HTML report

### Vue.js pipeline (4 steps)

1. **Lazyload** — same as Next.js step 1; sets `globalsUtil.getTech()` to `"vue"`
2. **Map** — scans the entire `outputDir` (Vue chunks spread across asset hosts)
3. **Analyze** — same rule loading as Next.js; `-r/--rules` is forwarded here too
4. **Report** — same as Next.js; if `endpoints.json` doesn't exist it is written as `[]` since Vue endpoints extraction isn't implemented yet

### Tech detection flow

`lazyLoad` sets the global tech string. If it remains `""` after lazyload, `run` exits (single URL) or skips (batch). Techs other than `"next"` and `"vue"` only get lazyload; the rest of the pipeline is skipped with a warning.

### Batch mode

When `-u` points to a file of URLs, each line is processed sequentially. For each URL:
- A subdirectory `output/<host>/` is created
- `clearJsUrls()` / `clearJsonUrls()` reset the URL sets so previous targets don't bleed over
- All output paths are prefixed with `workingDir/`

## Adding a new flag to `run`

1. Declare the option in `src/index.ts` on the `run` command (`.option(...)`)
2. If it configures a global, call the setter in the `action` handler before `await run(cmd)`
3. If it needs to reach a downstream module (like `analyze`), thread it through `cmd` — `processUrl` receives the full `cmd` object and passes it to submodule calls

**Example — `-r/--rules` flag (added in this codebase):**
- Declared in `src/index.ts`: `.option("-r, --rules <file/dir>", "Rules file or directory (passed to analyze module)")`
- In `src/run/index.ts` the `analyze` calls use `cmd.rules || ""` — empty string tells `analyze` to use the default rules cache

## Rules

Rules are YAML files (`.yml`/`.yaml`) in two places:
- **Workspace:** `../js-recon-rules/` (relative to this repo)
- **Installed cache:** `~/.js-recon/rules`

`initRules` downloads rules from GitHub when missing or when the cached version doesn't match the latest release. Rules may declare `js_recon_version: ">=X.Y.Z"`; incompatible rules are skipped with a warning. The version check strips prerelease suffixes (e.g. `1.3.1-alpha.3` → `[1,3,1]`).

Rule categories:
- `ast/` — AST-based pattern matching against chunk code (uses `@babel/parser` + `esquery`)
- `request/` — OpenAPI/request-level checks against the resolved endpoint list

When `-r` points to a single file, only that rule is loaded. When it points to a directory, all `.yml`/`.yaml` files are loaded recursively.

## Testing a change

**Testing is mandatory for every change.** Before reporting a task complete:

1. Run `npm run cleanup` to rebuild TypeScript.
2. Run the `run` subcommand against the target the user provides. Do not use `analyze` or other individual subcommands as a substitute — the `run` subcommand must be used to validate end-to-end behavior.
3. If the user has not provided a target, ask for one before proceeding.

Typical test invocation:

```bash
npm run cleanup && npm run start -- run -u <target-url> -y -k
```

## Security / confidentiality

When a change is informed by behavior observed on a real target (URLs, endpoint names, response shapes, finding details, etc.):

- **Do not include any target information in code comments, commit messages, docstrings, variable names, or any other artifact.**
- This applies to hostnames, paths, parameter names, response content, or any other detail that could identify the target.
- If context from the target is needed to describe a change, describe it in abstract terms only (e.g. "URL parameter passed to fetch" not "https://example.com/api/docs passes `file` param to fetch").
