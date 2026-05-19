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
| `run` | Run all of the above in sequence |
| `api-gateway` | Manage AWS API Gateway for IP rotation |
| `mcp` | Interactive AI-powered CLI |

## Key source files

- `src/index.ts` — CLI entry point; all subcommand definitions live here
- `src/run/index.ts` — orchestrates the full pipeline (`run` subcommand)
- `src/analyze/index.ts` — loads/validates rules, runs AST and request engines
- `src/analyze/helpers/initRules.ts` — downloads/caches rules from GitHub to `~/.js-recon/rules`
- `src/analyze/helpers/validate.ts` — validates rules and checks `js_recon_version` compatibility
- `src/analyze/helpers/schemas.ts` — Zod schema for rule YAML files
- `src/map/next_js/resolveFetch.ts` — resolves `fetch()` calls, detects Next.js framework chunks
- `src/map/next_js/utils.ts` — `resolveNodeValue`, `resolveVariableInChunk`, `substituteVariablesInString`
- `src/map/next_js/getWebpackConnections.ts` — extracts chunk code from webpack bundles
- `src/globalConfig.ts` — current version string and tool-wide constants

## Rules

Rules are YAML files (`.yml`/`.yaml`) living in two places:
- **Workspace:** `../js-recon-rules/` (relative to this repo)
- **Installed cache:** `~/.js-recon/rules`

`initRules` downloads rules from GitHub when missing or when the cached version doesn't match the GitHub latest. Rules may declare `js_recon_version: ">=X.Y.Z"`; incompatible rules are skipped with a warning. The version check strips prerelease suffixes (e.g. `1.3.1-alpha.3` → `[1,3,1]`).

Rule categories: `ast/` (AST-based pattern matching) and `request/` (OpenAPI/request-level checks).

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
