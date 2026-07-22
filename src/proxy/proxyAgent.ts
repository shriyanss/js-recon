import { ProxyAgent, Socks5ProxyAgent, type Dispatcher } from "undici";
import { parseProxyUrl } from "./genericProxy.js";
import { buildOxylabsProxyUrl, composeOxylabsUsername } from "./oxylabsProxy.js";
import type { ResolvedProxyConfig } from "./resolveProxyConfig.js";
import * as globalsUtil from "../utility/globals.js";

/** Reconstructs a ResolvedProxyConfig from the current proxy-related globals. */
export const getResolvedProxyConfigFromGlobals = (): ResolvedProxyConfig => {
    return {
        method: globalsUtil.getProxyMethod(),
        url: globalsUtil.getProxyUrl(),
        oxylabs: globalsUtil.getOxylabsConfig(),
    };
};

/** `RequestInit` extended with undici's `dispatcher` option (absent from the DOM lib's fetch types). */
export type FetchOptsWithDispatcher = RequestInit & { dispatcher?: Dispatcher };

/** Merges a proxy dispatcher (derived from the current globals) into fetch options, if a proxy is configured. */
export const withProxyDispatcher = (opts: RequestInit = {}): FetchOptsWithDispatcher => {
    const dispatcher = buildUndiciDispatcher(getResolvedProxyConfigFromGlobals());
    return dispatcher ? { ...opts, dispatcher } : opts;
};

/**
 * Builds an undici dispatcher for the resolved proxy config, to pass as `fetch(url, { dispatcher })`.
 * Returns null for the `aws` method (routed separately via genReq.ts) or no proxy configured.
 */
export const buildUndiciDispatcher = (resolved: ResolvedProxyConfig): Dispatcher | null => {
    if (resolved.method === "socks") {
        if (!resolved.url) return null;
        return new Socks5ProxyAgent(resolved.url);
    }
    if (resolved.method === "http") {
        if (!resolved.url) return null;
        return new ProxyAgent(resolved.url);
    }
    if (resolved.method === "oxylabs") {
        if (!resolved.oxylabs) return null;
        return new ProxyAgent(buildOxylabsProxyUrl(resolved.oxylabs));
    }
    return null;
};

export interface PuppeteerProxyArgs {
    arg: string | null;
    authenticate?: { username: string; password: string };
}

/**
 * Builds the Puppeteer `--proxy-server=` launch arg plus optional `page.authenticate()` credentials.
 * `aws` never applies here (Puppeteer never went through API Gateway).
 */
export const buildPuppeteerProxyArgs = (resolved: ResolvedProxyConfig): PuppeteerProxyArgs => {
    if (resolved.method === "socks" || resolved.method === "http") {
        if (!resolved.url) return { arg: null };
        const parsed = parseProxyUrl(resolved.url);
        const arg = `--proxy-server=${parsed.protocol}://${parsed.host}:${parsed.port}`;
        if (parsed.username && parsed.password) {
            return { arg, authenticate: { username: parsed.username, password: parsed.password } };
        }
        return { arg };
    }
    if (resolved.method === "oxylabs") {
        if (!resolved.oxylabs) return { arg: null };
        return {
            arg: "--proxy-server=pr.oxylabs.io:7777",
            authenticate: {
                username: composeOxylabsUsername(resolved.oxylabs),
                password: resolved.oxylabs.password,
            },
        };
    }
    return { arg: null };
};
