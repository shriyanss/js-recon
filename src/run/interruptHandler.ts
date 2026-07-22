import chalk from "chalk";
import readline from "readline";

let isBatchMode = false;
let handling = false;
let sigintHandlerActive = false;
let pendingMenuPromise: Promise<void> | null = null;

let skipStepResolver: (() => void) | null = null;
let skipTarget = false;

const showMenu = async (): Promise<void> => {
    if (handling) return;
    handling = true;

    // Temporarily remove so a second Ctrl-C falls through to default exit
    process.removeListener("SIGINT", sigintHandler);

    process.stdout.write("\n");
    console.error(chalk.yellow("[!] Interrupted. What would you like to do?"));
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
                console.error(chalk.yellow("[!] Skipping current step..."));
                if (skipStepResolver) {
                    skipStepResolver();
                    skipStepResolver = null;
                }
            } else if (isBatchMode && choice === "2") {
                skipTarget = true;
                console.error(chalk.yellow("[!] Skipping current target..."));
                if (skipStepResolver) {
                    skipStepResolver();
                    skipStepResolver = null;
                }
            } else if (choice === (isBatchMode ? "3" : "2")) {
                console.error(chalk.yellow("[!] Exiting..."));
                process.exit(0);
            } else {
                console.error(chalk.yellow("[!] Invalid choice. Continuing..."));
            }

            resolve();
        });
    });

    // Reinstall for subsequent interrupts
    process.on("SIGINT", sigintHandler);
    handling = false;
};

const sigintHandler = () => {
    pendingMenuPromise = showMenu().catch(() => {});
};

export const installSigintHandler = (isBatch: boolean): void => {
    isBatchMode = isBatch;
    skipTarget = false;
    skipStepResolver = null;
    handling = false;
    sigintHandlerActive = true;
    process.on("SIGINT", sigintHandler);
};

export const removeSigintHandler = (): void => {
    sigintHandlerActive = false;
    process.removeListener("SIGINT", sigintHandler);
};

// While `run` owns SIGINT, Puppeteer's own default handleSIGINT must be disabled
// on every `puppeteer.launch()` call — otherwise Puppeteer kills the browser
// out-of-band the instant Ctrl-C is pressed, which throws the in-flight step and
// races the outer `finally`'s `process.exit()` against this handler's pending prompt.
export const isSigintHandlerActive = (): boolean => sigintHandlerActive;

// Lets callers (e.g. the outer pipeline `finally`) avoid exiting while a menu
// prompt triggered by this handler is still awaiting the user's answer.
export const waitForPendingInterrupt = async (): Promise<void> => {
    if (pendingMenuPromise) {
        await pendingMenuPromise;
    }
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
