export interface OxylabsConfig {
    username: string;
    password: string;
    country?: string;
    city?: string;
    sessionId?: string;
}

/**
 * Composes the Oxylabs residential-proxy username: auth is entirely encoded here, no separate API.
 * customer-USERNAME[-cc-XX][-cc-XX-city-<name>][-sessid-<id>]
 * A city requires a country to already be set (Oxylabs' own format nests city under cc-XX).
 */
export const composeOxylabsUsername = (cfg: OxylabsConfig): string => {
    if (cfg.city && !cfg.country) {
        throw new Error("Oxylabs config: `city` requires `country` to also be set.");
    }

    let username = `customer-${cfg.username}`;
    if (cfg.country) {
        username += `-cc-${cfg.country}`;
        if (cfg.city) {
            username += `-city-${cfg.city}`;
        }
    }
    if (cfg.sessionId) {
        username += `-sessid-${cfg.sessionId}`;
    }
    return username;
};

const OXYLABS_ENTRY_ENDPOINT = "pr.oxylabs.io:7777";

/** Composes the full Oxylabs proxy URL (http, since the entry endpoint speaks HTTP/HTTPS/HTTP3/SOCKS5 all on one port). */
export const buildOxylabsProxyUrl = (cfg: OxylabsConfig): string => {
    const username = composeOxylabsUsername(cfg);
    return `http://${encodeURIComponent(username)}:${encodeURIComponent(cfg.password)}@${OXYLABS_ENTRY_ENDPOINT}`;
};
