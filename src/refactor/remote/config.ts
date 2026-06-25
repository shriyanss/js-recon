import fs from "fs";
import os from "os";
import path from "path";

export type RefactorConfig = {
    maxCacheSizeMb: number;
};

const DEFAULT_CONFIG: RefactorConfig = {
    maxCacheSizeMb: 512,
};

export const getRefactorConfigDir = (): string => path.join(os.homedir(), ".js-recon", "refactor");

const getConfigFilePath = (): string => path.join(getRefactorConfigDir(), "config.json");

export const loadRefactorConfig = (): RefactorConfig => {
    const dir = getRefactorConfigDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const configPath = getConfigFilePath();
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
        return { ...DEFAULT_CONFIG };
    }

    let raw: unknown;
    try {
        raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch {
        return { ...DEFAULT_CONFIG };
    }

    if (typeof raw !== "object" || raw === null) return { ...DEFAULT_CONFIG };
    const cfg = raw as Record<string, unknown>;
    const maxCacheSizeMb =
        typeof cfg.maxCacheSizeMb === "number" && cfg.maxCacheSizeMb > 0
            ? cfg.maxCacheSizeMb
            : DEFAULT_CONFIG.maxCacheSizeMb;
    return { maxCacheSizeMb };
};

export const saveRefactorConfig = (config: RefactorConfig): void => {
    const dir = getRefactorConfigDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getConfigFilePath(), JSON.stringify(config, null, 2));
};

// Validates config and returns a list of warning strings (empty = valid).
export const validateRefactorConfig = (config: RefactorConfig): string[] => {
    const warnings: string[] = [];
    if (typeof config.maxCacheSizeMb !== "number" || config.maxCacheSizeMb <= 0) {
        warnings.push(`config.maxCacheSizeMb must be a positive number (got ${config.maxCacheSizeMb})`);
    }
    return warnings;
};
