# `src/map/vue_js` — Vue (and shared) resolvers

## Purpose

Resolves API calls in Vue/Vite bundles. Also hosts framework-agnostic resolvers (`vue_resolveXhr`, `vue_resolveHttpClient`) imported by React and Svelte — the `vue_` prefix is historical; in practice this dir is the home of every webpack-style RPC-wrapper resolver.

## Files

- `getViteConnections.ts` — extracts module graphs from Vite output.
- `vue_resolveFetch.ts` — `fetch(...)` resolver for Vue/Vite chunks. Vue-specific.
- `vue_resolveXhr.ts` — directory-scan resolver for `new XMLHttpRequest()` + `.open()/.setRequestHeader()/.send()` patterns. Framework-agnostic; `frameworkName` arg only changes log labels. Reaches the ground-truth XHR sites; in axios/Got/Ky-style bundles the URL/method come from a dispatcher config (`re.url`, `re.method`) and resolve only to opaque `[member:re.url]` placeholders — those entries fail `looksLikeUrl` at emit time. Catch the wrapper-level call via `vue_resolveHttpClient` instead.
- `vue_resolveHttpClient.ts` — directory-scan resolver for `<obj>.<verb>(<url>, [body], [config])` where `<verb>` ∈ {get,post,put,delete,patch,head,options}. Designed for bundles whose transport layer overrides `XMLHttpRequest.prototype.{open,send,setRequestHeader}` (axios `xhrAdapter` and similar). The URL is composed at the client-instance call site, not inside the adapter. The `looksLikeUrl` heuristic (post-placeholder-strip, must contain `/` or scheme) filters `Map.get` / `Headers.delete` / `EventBus.post` false positives while keeping partially-resolved URLs.

  Three resolution stages per callsite:
  1. `resolveFromAssignments` — walks `binding.constantViolations` for `[unresolved: NAME]` markers, so `let X; ... (X = a + "/" + b)` resolves correctly. Needed because `resolveNodeValue`'s Identifier handler only looks at `binding.init`.
  2. `expandParamPlaceholders` — fans out one captured callsite into one URL per caller chain. Walks `enclosingFn.parent` to find which named function declares each `[param:X]` and substitutes every placeholder owned by that function from a single caller's args (never mixing args from different callsites). Recurses through forwarding wrappers.
  3. `substituteCallerPlaceholders` / `substituteCallerHeaders` — taint substitution for body/header placeholders without multi-caller fan-out.

  Wired into Vue / React / Svelte pipelines in `map/index.ts`.
- `bodyResolver.ts` — request-body resolution shared by the HTTP-client and XHR resolvers.
- `taint_utils.ts` — shared taint analysis primitives. Several non-obvious pieces exist specifically to make the resolvers above work on webpack output:
  - `EnclosingFn.paramNames` + `parent` chain — `resolveNodeValue` emits `[param:X]` for any param at any index in any enclosing function. The chain lets helpers resolve such a marker against the scope that actually declared X (callsites nested inside anonymous `.then(function ($) {...})` whose own params don't include X).
  - `buildAliasMap` — collects `{ exportedName: localBinding }` and `{ exportedName: () => localBinding }` from object literals **per-file**. Webpack's `a.d(b, { name: () => Binding })` getter exports and re-export registries (`const ae = { request: Me }`) hide the local minifier name behind a meaningful key. Without this, `getCallers("Me")` misses every `ae.request(...)` call. Map MUST be file-scoped — minifier locals like `Se`, `Me` collide across modules.
  - `makeGetCallers` accepts `sourceFile` for file-scoped alias lookup. Direct minifier-local matches (`bindingName.length ≤ 2`) are dropped from candidates (too many false positives across files); meaningful aliases (length > 2) are kept for both bare-identifier and member-expression matching. Overflow returns the partial caller list rather than nothing.
- `interactive.ts` + `interactive_helpers/` — blessed REPL and headless command runner. Re-exports `esqueryGen` and `inputPatch` from `../next_js/interactive_helpers/`.

## Patterns / gotchas

- **The `vue_` prefix lies.** `vue_resolveHttpClient` and `vue_resolveXhr` are framework-agnostic; the React/Svelte pipelines import them directly.
- **Per-file alias maps are load-bearing.** Globalizing the alias map blends unrelated functions; the file-scoping comment in `taint_utils.ts` documents this. Don't optimize it away.
- **Resolution stages are ordered.** `resolveFromAssignments` runs before `expandParamPlaceholders` runs before taint substitution. Reordering changes which markers survive into the next stage.
- **OpenAPI filter at emit time.** Even fully resolved entries can be silently dropped by `looksLikeUrl`. If a URL "disappears" downstream, check that filter first.

## How to test changes here

```bash
npx tsc
node --max-old-space-size=8192 build/index.js map \
  -d output/<host>/static/js -o /tmp/jsr-mapped -t <vue|react|svelte> -f json 2>&1 \
  | grep "URL: " | sort -u
```

Full acceptance via `run` per root `CLAUDE.md`.

## See also

- Root `CLAUDE.md` § "Reversing RPC-style API calls" — the workflow that produced the HTTP-client resolver.
- `../next_js/` — sibling framework dir; resolvers there have their own utils (don't share with `taint_utils.ts`).
- `../react_js/`, `../svelte_js/` — consumers of this dir's resolvers.
