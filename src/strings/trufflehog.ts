import chalk from "chalk";
import { execSync, spawn } from "child_process";

const isTrufflehogInstalled = (): boolean => {
    try {
        execSync("which trufflehog", { stdio: "pipe" });
        return true;
    } catch {
        return false;
    }
};

const maskSecret = (value: string): string => {
    if (!value || value.length <= 4) return "****";
    return value.slice(0, 4) + "****";
};

export const runTrufflehog = (directory: string): Promise<void> => {
    return new Promise((resolve) => {
        if (!isTrufflehogInstalled()) {
            console.error(chalk.red("[!] trufflehog not found in PATH."));
            console.error(
                chalk.yellow(
                    "    Install: curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sh"
                )
            );
            console.error(chalk.yellow("    Or: brew install trufflehog"));
            console.error(chalk.yellow("    Then re-run with --trufflehog."));
            process.exit(1);
        }

        console.log(chalk.cyan("[i] Running TruffleHog on output directory"));

        const proc = spawn("trufflehog", ["filesystem", directory, "--json", "--no-update"], {
            stdio: ["ignore", "pipe", "pipe"],
        });

        let totalFindings = 0;
        let buffer = "";

        proc.stdout.on("data", (chunk: Buffer) => {
            buffer += chunk.toString();
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const finding = JSON.parse(line);
                    const detector = finding.DetectorName ?? finding.detectorName ?? "Unknown";
                    const raw = finding.Raw ?? finding.raw ?? "";
                    const file =
                        finding.SourceMetadata?.Data?.Filesystem?.file ??
                        finding.sourceMetadata?.data?.filesystem?.file ??
                        "unknown file";
                    console.log(chalk.green(`[✓] [trufflehog] ${detector} found in ${file}`));
                    console.log(chalk.bgGreen(`  → ${maskSecret(raw)}`));
                    totalFindings++;
                } catch {
                    // not valid JSON, skip
                }
            }
        });

        proc.stderr.on("data", (chunk: Buffer) => {
            const msg = chunk.toString().trim();
            if (msg) {
                console.error(chalk.yellow(`[trufflehog] ${msg}`));
            }
        });

        proc.on("close", () => {
            if (totalFindings === 0) {
                console.log(chalk.yellow("[!] TruffleHog found no secrets"));
            } else {
                console.log(chalk.green(`[✓] TruffleHog found ${totalFindings} secrets`));
            }
            resolve();
        });
    });
};
