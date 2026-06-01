# `src/mcp` — LLM-driven interactive CLI

## Purpose

Powers the `mcp` subcommand. Wraps the rest of the tool (lazyload, map, analyze, etc.) as tools exposed to an LLM, then runs a REPL where the user types natural language and the LLM decides which subcommand to invoke. Not part of the `run` pipeline — entirely user-facing.

## Files

- `index.ts` — entrypoint. Bootstraps config, picks provider, hands off to `cli.ts`.
- `cli.ts` — REPL loop. Maintains session history; streams LLM responses to stdout.
- `commands.ts` — slash-commands available in the REPL (`/clear`, `/exit`, etc.) — not the underlying tool calls.
- `tools.ts` — tool definitions (JSON-schema) exposed to the LLM. Each tool wraps a js-recon subcommand. Adding a new tool here is how to give the LLM new capabilities.
- `providers.ts` — provider abstraction. Currently OpenAI and Anthropic; same prompt template used for both, differences encapsulated in this file.
- `config.ts` — reads API keys, default model, system prompt overrides.

## Patterns / gotchas

- **Provider parity is fragile.** Tool-call format and streaming chunks differ between OpenAI and Anthropic; if you add a feature, exercise both. The abstraction in `providers.ts` is thin.
- **Tool descriptions are prompts.** LLMs choose tools based on the description string. Adjusting a description without testing against both providers risks one provider routing wrong.
- **No background pipeline.** Tool calls are synchronous — long-running tools (full `run`) block the REPL. There's no progress streaming back to the LLM mid-tool today.
- **Config file path** is set in `config.ts`; mirror new config fields there or they'll be silently ignored.

## How to test changes here

Requires an API key. Run interactively:

```bash
npx tsc && node build/index.js mcp
```

There's no automated test path — manual REPL session is the verification.

## See also

- `../utility/ai.ts` — different code path (used inline by other dirs); don't confuse with the MCP-specific provider layer here.
