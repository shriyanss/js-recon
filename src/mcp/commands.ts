import chalk from "chalk";
import { SessionUsage } from "./providers.js";
import { McpConfig } from "./config.js";
import { getJobManager, formatJobsTable } from "./jobs.js";
import { loadSkills } from "./skills.js";

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

    "/jobs": {
        description: "List background jobs and their status",
        handler: (_args, _ctx) => {
            return { handled: true, output: "\n" + formatJobsTable() + "\n" };
        },
    },

    "/log": {
        description: "Show full captured output for a job: /log <id>",
        handler: (args, _ctx) => {
            const id = Number(args.trim());
            if (!Number.isFinite(id)) {
                return { handled: true, output: chalk.red("\n[!] Usage: /log <id>\n") };
            }
            const log = getJobManager().fullLog(id);
            if (log === undefined) return { handled: true, output: chalk.red(`\n[!] No job ${id}\n`) };
            return { handled: true, output: `\n--- Job ${id} log ---\n${log}\n--- end ---\n` };
        },
    },

    "/tail": {
        description: "Show last N lines of a job's output: /tail <id> [n]",
        handler: (args, _ctx) => {
            const parts = args.trim().split(/\s+/).filter(Boolean);
            const id = Number(parts[0]);
            if (!Number.isFinite(id)) {
                return { handled: true, output: chalk.red("\n[!] Usage: /tail <id> [n]\n") };
            }
            const nLines = parts[1] ? Math.max(1, Number(parts[1])) : 30;
            const tail = getJobManager().tailJob(id, 16 * 1024);
            if (tail === undefined) return { handled: true, output: chalk.red(`\n[!] No job ${id}\n`) };
            const lines = tail.split("\n");
            const slice = lines.slice(-nLines).join("\n");
            return { handled: true, output: `\n--- tail job ${id} ---\n${slice}\n--- end ---\n` };
        },
    },

    "/cancel": {
        description: "Cancel a running job: /cancel <id>",
        handler: (args, _ctx) => {
            const id = Number(args.trim());
            if (!Number.isFinite(id)) {
                return { handled: true, output: chalk.red("\n[!] Usage: /cancel <id>\n") };
            }
            const ok = getJobManager().cancelJob(id);
            if (!ok) return { handled: true, output: chalk.red(`\n[!] Cannot cancel job ${id} (not running or doesn't exist)\n`) };
            return { handled: true, output: chalk.yellow(`\n[!] Cancelling job ${id}...\n`) };
        },
    },

    "/skill": {
        description: "List or invoke a skill: /skill [<name> [--param value ...]]",
        handler: (args, _ctx) => {
            const trimmed = args.trim();
            if (!trimmed) {
                const skills = loadSkills();
                if (skills.length === 0) {
                    return {
                        handled: true,
                        output: chalk.yellow("\n[!] No skills found. They are shipped via the js-recon-rules release into ~/.js-recon/skills/.\n"),
                    };
                }
                const lines = [chalk.bold.cyan("\n  Available skills:\n")];
                for (const s of skills) {
                    lines.push(`  ${chalk.green(s.name.padEnd(20))} ${s.description}`);
                }
                lines.push("");
                return { handled: true, output: lines.join("\n") };
            }
            if (trimmed === "reload") {
                const skills = loadSkills(true);
                return { handled: true, output: chalk.cyan(`\n[i] Reloaded ${skills.length} skill(s).\n`) };
            }
            return { handled: true, output: `__INVOKE_SKILL__${trimmed}` };
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
    return Object.keys(commands).filter((cmd) => cmd.startsWith(lower));
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
