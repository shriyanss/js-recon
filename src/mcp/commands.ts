import chalk from "chalk";
import { SessionUsage } from "./providers.js";
import { McpConfig } from "./config.js";

export interface CommandResult {
    handled: boolean;
    exit?: boolean;
    output?: string;
}

export interface CommandContext {
    usage: SessionUsage;
    config: McpConfig;
    provider: string;
    model: string;
    conversationLength: number;
}

interface CommandDef {
    description: string;
    handler: (args: string, ctx: CommandContext) => CommandResult;
}

const commands: Record<string, CommandDef> = {
    "/help": {
        description: "Show available commands",
        handler: (_args, _ctx) => {
            const lines = [
                chalk.bold.cyan("\n  Available Commands:\n"),
                ...Object.entries(commands).map(
                    ([name, def]) => `  ${chalk.green(name.padEnd(16))} ${def.description}`
                ),
                "",
            ];
            return { handled: true, output: lines.join("\n") };
        },
    },

    "/exit": {
        description: "Exit the MCP CLI",
        handler: (_args, _ctx) => {
            return { handled: true, exit: true, output: chalk.yellow("\nGoodbye!\n") };
        },
    },

    "/cost": {
        description: "Show token usage and estimated cost for this session",
        handler: (_args, ctx) => {
            return { handled: true, output: "\n" + ctx.usage.formatCost() + "\n" };
        },
    },

    "/clear": {
        description: "Clear conversation history (keeps system prompt)",
        handler: (_args, _ctx) => {
            return { handled: true, output: chalk.cyan("\n[i] Conversation history cleared.\n") };
        },
    },

    "/model": {
        description: "Show or switch the current model (e.g. /model gpt-4o)",
        handler: (args, ctx) => {
            if (!args.trim()) {
                return {
                    handled: true,
                    output: `__LIST_MODELS__`,
                };
            }
            return {
                handled: true,
                output: `__SWITCH_MODEL__${args.trim()}`,
            };
        },
    },

    "/provider": {
        description: "Show or switch provider (e.g. /provider anthropic)",
        handler: (args, ctx) => {
            const val = args.trim().toLowerCase();
            if (!val) {
                return {
                    handled: true,
                    output: chalk.cyan(`\n  Current provider: ${ctx.provider}\n`),
                };
            }
            if (val !== "openai" && val !== "anthropic") {
                return {
                    handled: true,
                    output: chalk.red(`\n[!] Invalid provider: ${val}. Use 'openai' or 'anthropic'.\n`),
                };
            }
            return {
                handled: true,
                output: `__SWITCH_PROVIDER__${val}`,
            };
        },
    },

    "/status": {
        description: "Show current session status",
        handler: (_args, ctx) => {
            const lines = [
                chalk.bold.cyan("\n  Session Status:\n"),
                `  Provider:             ${ctx.provider}`,
                `  Model:                ${ctx.model}`,
                `  Conversation length:  ${ctx.conversationLength} messages`,
                `  Total tokens used:    ${ctx.usage.getStats().totalTokens.toLocaleString()}`,
                `  Estimated cost:       $${ctx.usage.getStats().estimatedCost.toFixed(6)}`,
                "",
            ];
            return { handled: true, output: lines.join("\n") };
        },
    },

    "/config": {
        description: "Show current configuration",
        handler: (_args, ctx) => {
            const lines = [
                chalk.bold.cyan("\n  MCP Configuration:\n"),
                `  Provider:          ${ctx.config.provider}`,
                `  Model:             ${ctx.config.model}`,
                `  Output dir:        ${ctx.config.default_output_dir}`,
                `  Threads:           ${ctx.config.default_threads}`,
                `  History limit:     ${ctx.config.history_limit}`,
                `  OpenAI key:        ${ctx.config.openai_api_key ? "***" + ctx.config.openai_api_key.slice(-4) : "(not set)"}`,
                `  Anthropic key:     ${ctx.config.anthropic_api_key ? "***" + ctx.config.anthropic_api_key.slice(-4) : "(not set)"}`,
                "",
            ];
            return { handled: true, output: lines.join("\n") };
        },
    },

    "/save": {
        description: "Save current session config to ~/.js-recon/mcp.yaml",
        handler: (_args, _ctx) => {
            return { handled: true, output: "__SAVE_CONFIG__" };
        },
    },

    "/models": {
        description: "List available models for current provider",
        handler: (_args, _ctx) => {
            return { handled: true, output: "__LIST_MODELS__" };
        },
    },
};

/**
 * Gets all available command names for autocomplete.
 */
export const getCommandNames = (): string[] => {
    return Object.keys(commands);
};

/**
 * Gets command suggestions based on partial input.
 */
export const getCommandSuggestions = (partial: string): string[] => {
    const lower = partial.toLowerCase();
    return Object.keys(commands).filter(cmd => cmd.startsWith(lower));
};

/**
 * Processes a slash command. Returns a CommandResult indicating whether it was handled.
 */
export const processCommand = (input: string, ctx: CommandContext): CommandResult => {
    const trimmed = input.trim();
    if (!trimmed.startsWith("/")) {
        return { handled: false };
    }

    const spaceIdx = trimmed.indexOf(" ");
    const cmdName = spaceIdx === -1 ? trimmed : trimmed.substring(0, spaceIdx);
    const args = spaceIdx === -1 ? "" : trimmed.substring(spaceIdx + 1);

    const cmd = commands[cmdName.toLowerCase()];
    if (!cmd) {
        return {
            handled: true,
            output: chalk.red(`\n[!] Unknown command: ${cmdName}. Type /help for available commands.\n`),
        };
    }

    return cmd.handler(args, ctx);
};
