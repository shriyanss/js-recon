# `src/mcp` — LLM-driven interactive CLI

## Purpose

Powers the `mcp` subcommand. Wraps the rest of the tool (lazyload, map, analyze, etc.) as tools exposed to an LLM, then runs a REPL where the user types natural language and the LLM decides which subcommand to invoke. Not part of the `run` pipeline — entirely user-facing.

## Modes

The `mcp` subcommand has three mutually exclusive modes:

- `--cli` — interactive REPL (original behavior).
- `-c/--chat "<prompt>"` — one-shot non-interactive chat. Repeatable; each prompt runs in sequence using the same session history. Prints the assistant reply to stdout and exits.
- `--server` — speaks the Model Context Protocol over stdio so the tool can be wired into Claude Code, Cursor, etc. as an MCP tool provider.

## Files

- `index.ts` — entrypoint. Dispatches between `--server`, `-c/--chat`, and `--cli`.
- `cli.ts` — REPL loop. Maintains session history; streams LLM responses to stdout. Exports `SYSTEM_PROMPT` so the one-shot runner reuses the same prompt.
- `chatOneShot.ts` — non-interactive runner for `-c/--chat`. Mirrors `cli.ts` bootstrap (creds resolution, intent detection, tool execution) without `readline`/`inquirer`.
- `intent.ts` — shared `detectIntent` + `handleToolExecution`. Both `cli.ts` and `chatOneShot.ts` import from here.
- `commands.ts` — slash-commands available in the REPL (`/clear`, `/exit`, etc.).
- `tools.ts` — tool wrappers around `lazyLoad` and `run` used by the intent runner.
- `mcpServer.ts` — Model Context Protocol stdio server (`--server`). Registers `lazyload`, `strings`, `map`, `endpoints`, `analyze`, `report`, `run` as MCP tools. Wraps each subcommand call in `captureStdout` so the chatty `console.log` output is redirected to stderr (stdout is owned by the JSON-RPC transport) and returned as the tool result text.
- `providers.ts` — provider abstraction. Adds `createAnthropicOAuthProvider(accessToken, model)` for Claude Code OAuth bearer tokens (sets the `anthropic-beta: oauth-2025-04-20` header).
- `claudeCodeCreds.ts` — reads Claude Code OAuth credentials (macOS keychain service `Claude Code-credentials`, or `~/.claude/.credentials.json` on Linux), refreshes when expired (warns the user; disable with `--no-refresh-claude-creds`), and writes the refreshed token back. OAuth tokens are never persisted to `~/.js-recon/mcp.yaml`.
- `config.ts` — reads API keys, default model, system prompt overrides.

## Patterns / gotchas

- **Provider parity is fragile.** Tool-call format and streaming chunks differ between OpenAI and Anthropic; if you add a feature, exercise both. The abstraction in `providers.ts` is thin.
- **Tool descriptions are prompts.** LLMs choose tools based on the description string. Adjusting a description without testing against both providers risks one provider routing wrong.
- **No background pipeline.** Tool calls are synchronous — long-running tools (full `run`) block the REPL. There's no progress streaming back to the LLM mid-tool today.
- **Config file path** is set in `config.ts`; mirror new config fields there or they'll be silently ignored.

## How to test changes here

Requires an API key OR a working `claude` login on the same machine. Run interactively:

```bash
npx tsc && node build/index.js mcp --cli
```

One-shot smoke test:

```bash
node build/index.js mcp -c "hello"
```

MCP-protocol smoke test (lists registered tools, no stray stdout from subcommands):

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node build/index.js mcp --server
```

To wire into Claude Code itself, add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "js-recon": {
      "command": "node",
      "args": ["/abs/path/to/js-recon/build/index.js", "mcp", "--server"]
    }
  }
}
```

There's no automated test path — manual REPL / MCP session is the verification.

## See also

- `../utility/ai.ts` — different code path (used inline by other dirs); don't confuse with the MCP-specific provider layer here.
