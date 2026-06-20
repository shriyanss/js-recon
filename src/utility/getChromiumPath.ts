import { execSync } from "child_process";
import fs from "fs";

const SYSTEM_CHROME_PATHS = [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
];

/**
 * Returns an executablePath for Puppeteer if a usable Chrome/Chromium is
 * available outside of Puppeteer's own download cache.
 *
 * Resolution order:
 *   1. PUPPETEER_EXECUTABLE_PATH env var (explicit override)
 *   2. Well-known system paths
 *   3. `which google-chrome || which chromium-browser || which chromium`
 *
 * Returns undefined when nothing is found — Puppeteer will then fall back to
 * its bundled Chrome, which may fail on systems with missing shared libraries.
 */
export function getChromiumPath(): string | undefined {
    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (envPath && fs.existsSync(envPath)) return envPath;

    for (const p of SYSTEM_CHROME_PATHS) {
        if (fs.existsSync(p)) return p;
    }

    try {
        const found = execSync(
            "which google-chrome-stable || which google-chrome || which chromium-browser || which chromium",
            { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
        ).trim();
        if (found && fs.existsSync(found)) return found;
    } catch {
        // nothing in PATH
    }

    return undefined;
}
