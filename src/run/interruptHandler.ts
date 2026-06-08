import chalk from "chalk";
import readline from "readline";

let isBatchMode = false;
let handling = false;

let skipStepResolver: (() => void) | null = null;
let skipTarget = false;

const showMenu = async (): Promise<void> => {
    if (handling) return;
    handling = true;

    // Temporarily remove so a second Ctrl-C falls through to default exit
    process.removeListener("SIGINT", sigintHandler);

    process.stdout.write("\n");
    console.log(chalk.yellow("[!] Interrupted. What would you like to do?"));
    console.log(chalk.white("  1. Skip the current step"));
    if (isBatchMode) {
        console.log(chalk.white("  2. Skip the current target and move to the next"));
        console.log(chalk.white("  3. Exit"));
    } else {
        console.log(chalk.white("  2. Exit"));
    }

    const validChoices = isBatchMode ? ["1", "2", "3"] : ["1", "2"];
    const prompt = chalk.cyan(`Enter choice [${validChoices.join("/")}]: `);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    await new Promise<void>((resolve) => {
        rl.question(prompt, (answer) => {
            rl.close();
            const choice = answer.trim();

            if (choice === "1") {
                console.log(chalk.yellow("[!] Skipping current step..."));
                if (skipStepResolver) {
                    skipStepResolver();
                    skipStepResolver = null;
                }
            } else if (isBatchMode && choice === "2") {
                skipTarget = true;
                console.log(chalk.yellow("[!] Skipping current target..."));
                if (skipStepResolver) {
                    skipStepResolver();
                    skipStepResolver = null;
                }
            } else if (choice === (isBatchMode ? "3" : "2")) {
                console.log(chalk.yellow("[!] Exiting..."));
                process.exit(0);
            } else {
                console.log(chalk.yellow("[!] Invalid choice. Continuing..."));
            }

            resolve();
        });
    });

    // Reinstall for subsequent interrupts
    process.on("SIGINT", sigintHandler);
    handling = false;
};

const sigintHandler = () => {
    showMenu().catch(() => {});
};

export const installSigintHandler = (isBatch: boolean): void => {
    isBatchMode = isBatch;
    skipTarget = false;
    skipStepResolver = null;
    handling = false;
    process.on("SIGINT", sigintHandler);
};

export const removeSigintHandler = (): void => {
    process.removeListener("SIGINT", sigintHandler);
};

export const getSkipStepPromise = (): Promise<void> => {
    return new Promise<void>((resolve) => {
        skipStepResolver = resolve;
    });
};

export const resetSkipStep = (): void => {
    skipStepResolver = null;
};

export const shouldSkipTarget = (): boolean => skipTarget;

export const resetSkipTarget = (): void => {
    skipTarget = false;
};
