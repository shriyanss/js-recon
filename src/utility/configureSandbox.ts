import chalk from "chalk";
import * as globalsUtil from "./globals.js";

/**
 * Configures the browser sandbox based on command-line flags and environment variables.
 * @param cmd - The commander command object.
 */
const configureSandbox = (cmd) => {
    if (process.env.IS_DOCKER === "true" || cmd.sandbox === false) {
        globalsUtil.setDisableSandbox(true);
        console.log(chalk.yellow(`[!] Disabling browser sandbox`));
    }
};

export default configureSandbox;