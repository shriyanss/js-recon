import fs from "fs";
import chalk from "chalk";
import * as globalsUtil from "./globals.js";
import { resolveProxyConfig } from "../proxy/resolveProxyConfig.js";
import { parseProxyUrl } from "../proxy/genericProxy.js";
import { composeOxylabsUsername } from "../proxy/oxylabsProxy.js";

/**
 * Reads the proxy config file (if present), resolves CLI > env > file precedence via
 * resolveProxyConfig, and sets the resulting proxy-related globals.
 * @param cmd - The commander command object.
 */
const configureProxy = (cmd): void => {
    const configFile = cmd.proxyConfig || ".proxy_config.json";

    let configFileParsed = {};
    if (fs.existsSync(configFile)) {
        try {
            configFileParsed = JSON.parse(fs.readFileSync(configFile, "utf8"));
        } catch (err) {
            console.error(
                chalk.yellow(`[!] Failed to parse proxy config file ${configFile}: ${err.message}. Proceeding with no proxy.`)
            );
            configFileParsed = {};
        }
    }

    const resolved = resolveProxyConfig({
        cli: {
            proxyMethod: cmd.proxyMethod,
            proxyUrl: cmd.proxy,
            oxylabsUsername: cmd.oxylabsUsername,
            oxylabsPassword: cmd.oxylabsPassword,
            oxylabsCountry: cmd.oxylabsCountry,
            oxylabsCity: cmd.oxylabsCity,
            oxylabsSessionId: cmd.oxylabsSessionId,
        },
        env: process.env,
        ignoreEnv: cmd.ignoreProxyEnv === true,
        configFileParsed,
    });

    if ((resolved.method === "socks" || resolved.method === "http") && resolved.url) {
        try {
            parseProxyUrl(resolved.url);
        } catch (err) {
            console.error(chalk.red(`[!] Invalid proxy URL: ${err.message}`));
            process.exit(1);
        }
    }

    if (resolved.method === "oxylabs" && resolved.oxylabs) {
        try {
            composeOxylabsUsername(resolved.oxylabs);
        } catch (err) {
            console.error(chalk.red(`[!] Invalid Oxylabs config: ${err.message}`));
            process.exit(1);
        }
    }

    globalsUtil.setProxyConfigFile(configFile);
    globalsUtil.setIgnoreProxyEnv(cmd.ignoreProxyEnv === true);
    globalsUtil.setProxyMethod(resolved.method);
    globalsUtil.setUseProxy(resolved.method !== null);
    globalsUtil.setProxyUrl(resolved.url);
    globalsUtil.setOxylabsConfig(resolved.oxylabs);
};

export default configureProxy;
