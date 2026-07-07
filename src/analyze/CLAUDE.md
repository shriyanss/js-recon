# `src/analyze` — rule-based analysis engine

## Purpose

Powers the `analyze` subcommand. Loads YAML rules, runs them against `mapped.json` (AST engine) and `mapped-openapi.json` / endpoint lists (request engine), and writes `analyze.json`. Invoked from `run/index.ts` as step 9 (Next.js) / step 3 (Vue).

## Files

- `index.ts` — entrypoint. Loads rules (via `helpers/initRules` + `-r` override), splits them by category, dispatches to AST/request engines, writes `analyze.json`.
- `engine/astEngine.ts` — runs AST rules. Parses each chunk with `@babel/parser`, executes `esquery` selectors per step, supports tainted/scoped steps for data-flow chains.
- `engine/requestEngine.ts` — runs request-level rules against the resolved endpoint list (OpenAPI shape). Pattern-matches URLs, methods, headers, and body shapes.
- `helpers/initRules.ts` — fetches rules from the GitHub release matching the current tool version into `~/.js-recon/rules`. Honors `-r/--rules` for local overrides (file or dir).
- `helpers/validate.ts` — validates every loaded rule against the Zod schema; checks `js_recon_version` (required) against the current `globalConfig` version; strips prerelease suffixes when comparing.
- `helpers/schemas.ts` — Zod schema for rule YAML. Source of truth for what a rule can declare.
- `helpers/engineHelpers/` — small shared helpers (taint resolution, selector compilation, severity normalization).
- `types/` — TypeScript types for the rule shape and analyze output.

## Engines

### AST engine (`engine/astEngine.ts`)

Parses each chunk with `@babel/parser` + `esquery`. Supports multi-step chaining, `inScopeOf`, `taintFrom`, regex scan, postMessage resolver, and assignment checker. Rule type: `ast`.

### Request engine (`engine/requestEngine.ts`)

Matches resolved OpenAPI endpoint list by URL, header, and method patterns. Rule type: `request`.

### CS-MAST-S engine (`engine/csMastSEngine.ts`)

Checks whether a CS-MAST-S signature (PHC string) matches any node in a chunk's AST. Rule type: `cs-mast-s`.

**How it works:**

1. `parseSignature(step.csMastS.signature)` extracts `hash`, `lang`, `prsr`, `scat`, `sinc`, and `hashHex` from the PHC string.
2. `cs_mast_init(chunk.code, config)` builds a CS-MAST tree with the extracted config.
3. `treeContainsHash(tree.root, hashHex)` walks all tree nodes checking `node.computedHash`.
4. All steps must match in the same chunk for a finding to fire (AND logic).

**PHC signature format:**

```
$v=1$hash=sha256,lang=js,prsr=-babel/parser,scat=name_id$<64-hex-chars>
```

Scat categories are `_`-joined in the PHC string (`name_id` = `["name", "id"]`).

**Finding location field** reports the chunk ID and matched signature — exact node extraction is not available (the hash tree doesn't retain source positions). Use `map -c "esquery ..."` to locate the node precisely after a signature match.

**Performance note:** The engine caches the CS-MAST tree per `(chunkId, configKey)` across steps in the same rule to avoid redundant parses when multiple steps share the same scat config.

**Recommended scat config per experiment #25/#26:**

- `scat=name,id` — FP=0 per chunk for all tested sinks; portable for framework constants (`dangerouslySetInnerHTML.__html`, `eval`, `bypassSecurityTrustHtml`)
- `scat=id` only — structurally portable across bundlers for complex patterns but higher FP rate; use when minified variable names differ between bundles

## Patterns / gotchas

- **Rule cache version-gating:** `initRules` skips rules whose `js_recon_version` is incompatible with the running tool. Bumping `globalConfig.version` can silently drop rules — verify with `analyze.json` line counts.
- **`-r` flag:** points to a single `.yml`/`.yaml` file OR a directory (recursed). When empty string is passed (from `run/index.ts` default), falls back to the cache. Never resolve to a hardcoded path here.
- **AST vs request split:** AST rules read from `mapped.json` chunk source; request rules read from the resolved endpoint list. A rule that needs both must declare multiple steps with the right `engine` / `step.type`.
- **Tainted steps:** a step can reference a prior step's match as taint source; chaining is positional, so re-ordering steps changes semantics.
- **Per-tech filtering:** every rule declares `tech` (`next` / `vue` / `react` / `svelte` / `all`). The engine filters by the value `globalsUtil.getTech()` set during lazyload — running analyze on the wrong tech silently produces zero findings.

## How to test changes here

The fastest iteration loop is to run analyze alone against an existing `mapped.json`:

```bash
npx tsc && node build/index.js analyze -i output/<host> -r path/to/single-rule.yml
```

Final verification still goes through the full pipeline (`npm run cleanup && npm run start -- run -u <target> -y -k`) — see root `CLAUDE.md`.

## See also

- Root `CLAUDE.md` § "Rules" for rule file layout and version syntax.
- `../map/` — produces the AST input.
- `../report/` — consumes `analyze.json` for the HTML/SQLite report.
