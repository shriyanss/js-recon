import readline from "readline";
import chalk from "chalk";
import inquirer from "inquirer";
import { ChatMessage, LLMProvider, SessionUsage, createProvider, listModels, getDefaultModel } from "./providers.js";
import { McpConfig, resolveApiKey, saveConfig } from "./config.js";
import { processCommand, CommandContext, getCommandSuggestions } from "./commands.js";
import { runLazyload, runFullPipeline, summarizeLazyloadOutput, summarizeRunOutput } from "./tools.js";

const SYSTEM_PROMPT = `You are js-recon MCP, an AI assistant for JavaScript reconnaissance and security analysis.
You help users analyze websites by running js-recon modules against target URLs.

You have access to two main tools:
1. **lazyload** - Downloads and extracts JavaScript files from a target website. Detects frameworks (Next.js, Vue, Nuxt, Svelte, Angular) and downloads their JS bundles.
2. **run** - Runs the full js-recon pipeline (lazyload → strings → map → endpoints → analyze → report) against a target URL.

When the user asks you to scan/analyze/run against a website:
- If they want a quick JS file download, use lazyload.
- If they want a full analysis, use run.
- Always confirm the target URL before executing.

When the user asks to parse/summarize results:
- For lazyload results: provide a directory structure overview of downloaded files.
- For run results: read and summarize the output JSON files (endpoints, mapped functions, analysis, etc.).

Respond concisely and helpfully. When providing results, highlight security-relevant findings.`;

interface CliSession {
    provider: LLMProvider;
    providerName: "openai" | "anthropic";
    model: string;
    config: McpConfig;
    usage: SessionUsage;
    history: ChatMessage[];
    cliApiKey?: string;
    lastToolOutput?: string;
    lastOutputDir?: string;
    lastModule?: "lazyload" | "run";
    currentAbortController?: AbortController;
    configChanged: boolean;
}

/**
 * Detects intent from user message and decides whether to invoke a tool.
 */
const detectIntent = (
    message: string
): { action: "lazyload" | "run" | "parse_lazyload" | "parse_run" | "chat"; url?: string } => {
    const lower = message.toLowerCase();

    // Detect "parse" / "summarize" intents
    if (
        lower.includes("parse") ||
        lower.includes("summarize") ||
        lower.includes("summary") ||
        lower.includes("overview") ||
        lower.includes("show results") ||
        lower.includes("what did you find")
    ) {
        if (lower.includes("lazyload") || lower.includes("lazy load") || lower.includes("directory") || lower.includes("files")) {
            return { action: "parse_lazyload" };
        }
        return { action: "parse_run" };
    }

    // Detect run/scan intents
    const urlMatch = message.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : undefined;

    if (
        lower.includes("run against") ||
        lower.includes("full scan") ||
        lower.includes("full pipeline") ||
        lower.includes("full analysis") ||
        lower.includes("analyze")
    ) {
        return { action: "run", url };
    }

    if (
        lower.includes("lazyload") ||
        lower.includes("lazy load") ||
        lower.includes("download js") ||
        lower.includes("download javascript") ||
        lower.includes("grab js") ||
        lower.includes("fetch js")
    ) {
        return { action: "lazyload", url };
    }

    // If a URL is present and they seem to want scanning
    if (url && (lower.includes("scan") || lower.includes("run") || lower.includes("check") || lower.includes("test"))) {
        return { action: "run", url };
    }

    return { action: "chat", url };
};

/**
 * Handles tool execution based on detected intent.
 */
const handleToolExecution = async (
    session: CliSession,
    action: string,
    url?: string
): Promise<string | null> => {
    const outputDir = session.config.default_output_dir;
    const threads = session.config.default_threads;

    switch (action) {
        case "lazyload": {
            if (!url) return null;
            const result = await runLazyload(url, outputDir, threads);
            session.lastOutputDir = result.outputDir || outputDir;
            session.lastModule = "lazyload";
            session.lastToolOutput = result.message;
            return result.message;
        }
        case "run": {
            if (!url) return null;
            const result = await runFullPipeline(url, outputDir, threads);
            session.lastOutputDir = result.outputDir || outputDir;
            session.lastModule = "run";
            session.lastToolOutput = result.message;
            return result.message;
        }
        case "parse_lazyload": {
            const dir = session.lastOutputDir || outputDir;
            const summary = summarizeLazyloadOutput(dir);
            session.lastToolOutput = summary;
            return summary;
        }
        case "parse_run": {
            const summary = summarizeRunOutput(".");
            session.lastToolOutput = summary;
            return summary;
        }
        default:
            return null;
    }
};

/**
 * Prompts user to configure MCP settings interactively.
 */
const promptConfiguration = async (): Promise<{ provider: "openai" | "anthropic"; apiKey: string; model: string }> => {
    console.log(chalk.yellow("\n[!] No API key configured. Let's set up MCP.\n"));

    const { provider } = await inquirer.prompt([
        {
            type: "list",
            name: "provider",
            message: "Select LLM provider:",
            choices: ["openai", "anthropic"],
        },
    ]);

    const { apiKey } = await inquirer.prompt([
        {
            type: "password",
            name: "apiKey",
            message: `Enter ${provider === "openai" ? "OpenAI" : "Anthropic"} API key:`,
            mask: "*",
        },
    ]);

    const availableModels = await listModels(provider, apiKey);
    const defaultModel = getDefaultModel(provider);

    const { model } = await inquirer.prompt([
        {
            type: "list",
            name: "model",
            message: "Select model:",
            choices: availableModels,
            default: defaultModel,
        },
    ]);

    return { provider, apiKey, model };
};

/**
 * Starts the interactive MCP CLI session.
 */
export const startCli = async (config: McpConfig, cliApiKey?: string, cliModel?: string, cliProvider?: string): Promise<void> => {
    let providerName = (cliProvider || config.provider) as "openai" | "anthropic";
    let model = cliModel || config.model;
    let apiKey = resolveApiKey(providerName, cliApiKey, config);

    // If no API key, prompt user to configure
    if (!apiKey) {
        const configured = await promptConfiguration();
        providerName = configured.provider;
        apiKey = configured.apiKey;
        model = configured.model;

        // Update config and save
        config.provider = providerName;
        config.model = model;
        if (providerName === "openai") {
            config.openai_api_key = apiKey;
        } else {
            config.anthropic_api_key = apiKey;
        }
        saveConfig(config);
        console.log(chalk.green("\n[✓] Configuration saved to ~/.js-recon/mcp.yaml\n"));
    } else if (cliApiKey && !cliModel) {
        // Auto-detect model from provider when API key is provided
        model = getDefaultModel(providerName);
        console.log(chalk.cyan(`[i] Auto-detected model: ${model}\n`));
    }

    const provider = createProvider(providerName, apiKey, model);
    const usage = new SessionUsage(model);

    const session: CliSession = {
        provider,
        providerName,
        model,
        config,
        usage,
        history: [{ role: "system", content: SYSTEM_PROMPT }],
        cliApiKey,
        configChanged: false,
    };

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        completer: (line: string) => {
            if (line.startsWith("/")) {
                const suggestions = getCommandSuggestions(line);
                return [suggestions, line];
            }
            return [[], line];
        },
    });

    // Handle Ctrl-C to stop current process, not exit
    let ctrlCCount = 0;
    process.on("SIGINT", () => {
        if (session.currentAbortController) {
            console.log(chalk.yellow("\n\n[!] Stopping current process...\n"));
            session.currentAbortController.abort();
            session.currentAbortController = undefined;
            ctrlCCount = 0;
            prompt();
        } else {
            ctrlCCount++;
            if (ctrlCCount === 1) {
                console.log(chalk.yellow("\n\n[!] Press Ctrl-C again to exit, or type /exit\n"));
                setTimeout(() => { ctrlCCount = 0; }, 2000);
                prompt();
            } else {
                console.log(chalk.yellow("\nGoodbye!\n"));
                if (session.configChanged) {
                    console.log(chalk.cyan("[i] Config changes were made. Use /save to persist them.\n"));
                }
                rl.close();
                process.exit(0);
            }
        }
    });

    console.log(chalk.bold.cyan("\n  ╔══════════════════════════════════════╗"));
    console.log(chalk.bold.cyan("  ║         js-recon MCP CLI             ║"));
    console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝\n"));
    console.log(chalk.gray(`  Provider: ${providerName} | Model: ${model}`));
    console.log(chalk.gray(`  Type /help for commands, or chat naturally.\n`));

    const prompt = (): void => {
        rl.question(chalk.green("js-recon> "), async (input) => {
            const trimmed = input.trim();
            if (!trimmed) {
                prompt();
                return;
            }

            // Handle slash commands
            const cmdCtx: CommandContext = {
                usage,
                config,
                provider: session.providerName,
                model: session.model,
                conversationLength: session.history.length,
            };

            const cmdResult = processCommand(trimmed, cmdCtx);
            if (cmdResult.handled) {
                if (cmdResult.output) {
                    // Handle special output signals
                    if (cmdResult.output === "__LIST_MODELS__") {
                        const models = await listModels(session.providerName, resolveApiKey(session.providerName, session.cliApiKey, config));
                        console.log(chalk.cyan(`\n  Available models for ${session.providerName}:\n`));
                        models.forEach(m => {
                            const marker = m === session.model ? chalk.green(" ← current") : "";
                            console.log(`    ${m}${marker}`);
                        });
                        console.log("");
                    } else if (cmdResult.output.startsWith("__SWITCH_MODEL__")) {
                        const newModel = cmdResult.output.replace("__SWITCH_MODEL__", "");
                        session.model = newModel;
                        session.provider = createProvider(session.providerName, resolveApiKey(session.providerName, session.cliApiKey, config), newModel);
                        session.usage = new SessionUsage(newModel);
                        session.config.model = newModel;
                        session.configChanged = true;
                        console.log(chalk.green(`\n[✓] Switched model to: ${newModel}\n`));
                    } else if (cmdResult.output.startsWith("__SWITCH_PROVIDER__")) {
                        const newProvider = cmdResult.output.replace("__SWITCH_PROVIDER__", "") as "openai" | "anthropic";
                        const newKey = resolveApiKey(newProvider, session.cliApiKey, config);
                        if (!newKey) {
                            console.log(chalk.red(`\n[!] No API key configured for ${newProvider}.\n`));
                        } else {
                            session.providerName = newProvider;
                            const autoModel = getDefaultModel(newProvider);
                            session.model = autoModel;
                            session.provider = createProvider(newProvider, newKey, autoModel);
                            session.usage = new SessionUsage(autoModel);
                            session.config.provider = newProvider;
                            session.config.model = autoModel;
                            session.configChanged = true;
                            console.log(chalk.green(`\n[✓] Switched provider to: ${newProvider}\n`));
                            console.log(chalk.cyan(`[i] Auto-selected model: ${autoModel}\n`));
                        }
                    } else if (cmdResult.output === "__SAVE_CONFIG__") {
                        saveConfig(session.config);
                        session.configChanged = false;
                        console.log(chalk.green("\n[✓] Configuration saved to ~/.js-recon/mcp.yaml\n"));
                    } else {
                        console.log(cmdResult.output);
                    }
                }

                // Handle /clear
                if (trimmed.toLowerCase() === "/clear") {
                    session.history = [{ role: "system", content: SYSTEM_PROMPT }];
                }

                if (cmdResult.exit) {
                    if (session.configChanged) {
                        console.log(chalk.cyan("[i] Config changes were made. Use /save to persist them.\n"));
                    }
                    rl.close();
                    return;
                }
                prompt();
                return;
            }

            // Detect intent and possibly run tools
            const intent = detectIntent(trimmed);
            let toolContext = "";

            if (intent.action !== "chat") {
                session.currentAbortController = new AbortController();
                try {
                    const toolOutput = await handleToolExecution(session, intent.action, intent.url);
                    if (toolOutput) {
                        toolContext = `\n\n[Tool Output - ${intent.action}]:\n${toolOutput}`;
                    } else if ((intent.action === "lazyload" || intent.action === "run") && !intent.url) {
                        toolContext = "\n\n[System: No URL detected in the message. Ask the user for the target URL.]";
                    }
                } catch (err: any) {
                    if (err.name === "AbortError") {
                        toolContext = "\n\n[System: Process was stopped by user.]";
                    } else {
                        throw err;
                    }
                } finally {
                    session.currentAbortController = undefined;
                }
            }

            // Build user message with tool context
            const userMessage = toolContext ? `${trimmed}${toolContext}` : trimmed;
            session.history.push({ role: "user", content: userMessage });

            // Trim history if too long
            if (session.history.length > config.history_limit) {
                const system = session.history[0];
                session.history = [system, ...session.history.slice(-(config.history_limit - 1))];
            }

            try {
                session.currentAbortController = new AbortController();
                const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
                let spinIdx = 0;
                const spinnerInterval = setInterval(() => {
                    process.stdout.write(`\r${chalk.cyan(spinner[spinIdx++ % spinner.length])} Thinking...`);
                }, 80);

                const response = await session.provider.chat(session.history);
                clearInterval(spinnerInterval);
                process.stdout.write("\r" + " ".repeat(20) + "\r");
                session.currentAbortController = undefined;

                usage.addUsage(response.promptTokens, response.completionTokens);
                session.history.push({ role: "assistant", content: response.content });

                console.log(chalk.white("\n" + response.content + "\n"));
            } catch (err: any) {
                session.currentAbortController = undefined;
                if (err.name !== "AbortError") {
                    console.log(chalk.red(`\n[!] ${err.message}\n`));
                } else {
                    console.log(chalk.yellow("\n[!] Response generation stopped.\n"));
                }
            }

            prompt();
        });
    };

    prompt();
};
