import chalk from "chalk";
import { execSync, spawn } from "child_process";
import path from "path";
import { parse as shellParse } from "shell-quote";

const isSjInstalled = (sjBin: string): boolean => {
    try {
        execSync(`which ${sjBin}`, { stdio: "pipe" });
        return true;
    } catch {
        return false;
    }
};

export const runSwaggerJacker = (
    mappedOpenapiJsonPath: string,
    sjBin: string,
    sjArgsRaw: string,
    workingDir: string
): Promise<void> => {
    return new Promise((resolve) => {
        if (!isSjInstalled(sjBin)) {
            console.error(chalk.red(`[!] ${sjBin} not found in PATH.`));
            console.error(chalk.yellow("    Install: go install github.com/BishopFox/sj@latest"));
            console.error(chalk.yellow("    Then re-run with --sj."));
            process.exit(28);
        }

        console.log(chalk.cyan("[i] Running sj (swagger-jacker) against the mapped OpenAPI spec"));

        const baseArgs = [
            "automate",
            "-l",
            path.resolve(mappedOpenapiJsonPath),
            "--force",
            "-q",
            "-F",
            "json",
            "-o",
            "swagger-jacker-results.json",
        ];
        const extraArgs = shellParse(sjArgsRaw).filter((token): token is string => typeof token === "string");
        const args = [...baseArgs, ...extraArgs];

        const proc = spawn(sjBin, args, {
            cwd: workingDir,
            stdio: ["ignore", "pipe", "pipe"],
        });

        proc.stdout.on("data", (chunk: Buffer) => {
            const msg = chunk.toString().trim();
            if (msg) {
                console.log(chalk.green(`[sj] ${msg}`));
            }
        });

        proc.stderr.on("data", (chunk: Buffer) => {
            const msg = chunk.toString().trim();
            if (msg) {
                console.error(chalk.yellow(`[sj] ${msg}`));
            }
        });

        proc.on("close", (code) => {
            if (code === 0) {
                console.log(chalk.green("[✓] sj run complete"));
            } else {
                console.log(chalk.yellow(`[!] sj exited with code ${code}`));
            }
            resolve();
        });
    });
};
