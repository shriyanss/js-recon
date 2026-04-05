import chalk from "chalk";
import { loadConfig } from "./config.js";
import { startCli } from "./cli.js";

/**
 * Main entry point for the MCP module.
 * Loads configuration and starts the interactive CLI session.
 */
const mcp = async (
    cli: boolean,
    configFile: string | undefined,
    apiKey: string | undefined,
    model: string | undefined,
    provider: string | undefined
): Promise<void> => {
    console.log(chalk.cyan("[i] Loading 'MCP' module"));

    const config = loadConfig(configFile);

    if (cli) {
        await startCli(config, apiKey, model, provider);
    } else {
        console.log(chalk.yellow("[!] MCP module currently requires --cli flag for interactive mode."));
        console.log(chalk.cyan("[i] Usage: js-recon mcp --cli"));
    }
};

export default mcp;
