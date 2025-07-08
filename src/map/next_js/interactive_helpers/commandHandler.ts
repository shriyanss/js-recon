import chalk from "chalk";
import path from "path";
import commandHelpers from "./commandHelpers.js";
import { helpMenu } from "./helpMenu.js";
import { printFunction } from "./printer.js";
import { State } from "../interactive.js";
import { Widgets } from "blessed";

interface Screen {
    screen: any;
    titleBox?: Widgets.BoxElement;
    outputBox: Widgets.Log;
    inputBox: Widgets.TextboxElement;
}

async function handleCommand(text: string, state: State, ui: Screen) {
    const { chunks } = state;
    const { outputBox, inputBox, screen } = ui;

    if (
        text !== "" &&
        !text.match(/^\s+$/) &&
        text !== state.commandHistory[state.commandHistory.length - 1]
    ) {
        state.commandHistory.push(text);
        state.commandHistoryIndex = state.commandHistory.length;
    }
    if (state.lastCommandStatus) {
        outputBox.log(`${chalk.bgGreenBright("%")} ${text}`);
    } else {
        outputBox.log(`${chalk.bgRed("%")} ${text}`);
    }

    if (text === "") {
        state.lastCommandStatus = true;
    } else if (text === "exit") {
        return process.exit(0);
    } else if (text === "help") {
        let helpText = chalk.cyan("Available commands:\n");
        for (const [key, value] of Object.entries(helpMenu)) {
            helpText += chalk.green(`\n${key}:\n`);
            helpText += `  ${value.replace(/\n/g, "\n  ")}\n`;
        }
        outputBox.log(helpText);
        state.lastCommandStatus = true;
    } else if (text.startsWith("list")) {
        const usage = helpMenu.list;
        if (text.split(" ").length < 2) {
            outputBox.log(chalk.magenta(usage));
            state.lastCommandStatus = false;
        } else {
            const option = text.split(" ")[1];

            if (option === "") {
                outputBox.log(chalk.magenta(usage));
                state.lastCommandStatus = false;
            } else if (option === "fetch") {
                outputBox.log(commandHelpers.fetchMenu(chunks));
                state.lastCommandStatus = true;
            } else if (option === "all") {
                outputBox.log(commandHelpers.listAllFunctions(chunks));
                state.lastCommandStatus = true;
            } else if (option === "nav") {
                outputBox.log(
                    commandHelpers.navHistory(chunks, state.functionNavHistory)
                );
                state.lastCommandStatus = true;
            } else {
                outputBox.log(chalk.red(option) + " is not a valid option");
                state.lastCommandStatus = false;
            }
        }
    } else if (text.startsWith("go")) {
        const usage = helpMenu.go;
        if (text.split(" ").length < 2) {
            outputBox.log(chalk.magenta(usage));
            state.lastCommandStatus = false;
        } else {
            const funcName = text.split(" ")[1];
            if (funcName === "") {
                outputBox.log(chalk.magenta(usage));
                state.lastCommandStatus = false;
            } else if (funcName === "to") {
                const funcId = text.split(" ")[2];
                // check if the function exists
                if (chunks[funcId]) {
                    const funcCode = await commandHelpers.getFunctionCode(
                        chunks,
                        funcId,
                        state
                    );
                    printFunction(
                        outputBox,
                        funcCode,
                        chunks[funcId]?.description,
                        state.funcWriteFile
                    );
                    state.lastCommandStatus = true;
                } else {
                    outputBox.log(
                        chalk.red(`No function with ID ${funcId} found`)
                    );
                    state.lastCommandStatus = false;
                }
                state.functionNavHistory.push(funcId);
                state.functionNavHistoryIndex++;
            } else if (funcName === "back") {
                if (state.functionNavHistory.length > 0) {
                    if (state.functionNavHistoryIndex > 0) {
                        state.functionNavHistoryIndex--;
                        const funcId =
                            state.functionNavHistory[
                                state.functionNavHistoryIndex
                            ];

                        if (Object.keys(chunks).includes(funcId)) {
                            const funcCode =
                                await commandHelpers.getFunctionCode(
                                    chunks,
                                    funcId,
                                    state
                                );
                            printFunction(
                                outputBox,
                                funcCode,
                                chunks[funcId].description,
                                state.funcWriteFile
                            );
                            state.lastCommandStatus = true;
                        } else {
                            outputBox.log(
                                chalk.red(`No function with ID ${funcId} found`)
                            );
                            state.lastCommandStatus = false;
                        }
                    } else {
                        outputBox.log(chalk.red("No previous function found"));
                        state.lastCommandStatus = false;
                    }
                } else {
                    outputBox.log(chalk.red("No previous function found"));
                    state.lastCommandStatus = false;
                }
            } else if (funcName === "ahead") {
                if (state.functionNavHistory.length > 0) {
                    if (
                        state.functionNavHistoryIndex <
                        state.functionNavHistory.length - 1
                    ) {
                        state.functionNavHistoryIndex++;
                        const funcId =
                            state.functionNavHistory[
                                state.functionNavHistoryIndex
                            ];
                        if (Object.keys(chunks).includes(funcId)) {
                            const funcCode =
                                await commandHelpers.getFunctionCode(
                                    chunks,
                                    funcId,
                                    state
                                );
                            printFunction(
                                outputBox,
                                funcCode,
                                chunks[funcId].description,
                                state.funcWriteFile
                            );
                            state.lastCommandStatus = true;
                        } else {
                            outputBox.log(
                                chalk.red(`No function with ID ${funcId} found`)
                            );
                            state.lastCommandStatus = false;
                        }
                    } else {
                        outputBox.log(chalk.red("No next function found"));
                        state.lastCommandStatus = false;
                    }
                } else {
                    outputBox.log(chalk.red("No next function found"));
                    state.lastCommandStatus = false;
                }
            } else {
                outputBox.log(chalk.red(funcName) + " is not a valid option");
                state.lastCommandStatus = false;
            }
        }
    } else if (text === "clear") {
        outputBox.setText("");
        state.lastCommandStatus = true;
    } else if (text.startsWith("set")) {
        if (text.split(" ").length < 3) {
            outputBox.log(chalk.magenta(helpMenu.set));
            state.lastCommandStatus = false;
        } else {
            const option = text.split(" ")[1];
            if (option === "funcwritefile") {
                const fileName = text.split(" ")[2];
                state.funcWriteFile = path.join(`${fileName}`);
                outputBox.log(
                    chalk.green(
                        `Function write file set to ${state.funcWriteFile}`
                    )
                );
                state.lastCommandStatus = true;
            } else if (option === "writeimports") {
                // modify the var in state
                const modifyVal = text.split(" ")[2];
                if (modifyVal === "true") {
                    state.writeimports = true;
                    outputBox.log("writeimports: " + chalk.green("true"));
                    state.lastCommandStatus = true;
                } else if (modifyVal === "false") {
                    state.writeimports = false;
                    outputBox.log("writeimports: " + chalk.yellow("false"));
                    state.lastCommandStatus = true;
                } else {
                    outputBox.log(chalk.magenta(helpMenu.set));
                    state.lastCommandStatus = false;
                }
            } else {
                outputBox.log(chalk.red(option) + " is not a valid option");
                state.lastCommandStatus = false;
            }
        }
    } else if (text.startsWith("trace")) {
        const usage = helpMenu.trace;
        if (text.split(" ").length < 2) {
            outputBox.log(chalk.magenta(usage));
            state.lastCommandStatus = false;
        } else {
            const option = text.split(" ")[1];
            if (option === "") {
                outputBox.log(chalk.magenta(usage));
                state.lastCommandStatus = false;
            } else {
                const funcName = text.split(" ")[1];
                outputBox.log(commandHelpers.traceFunction(chunks, funcName));
                state.lastCommandStatus = true;
            }
        }
    } else {
        outputBox.log((chalk.red(text), "is not a valid command"));
        state.lastCommandStatus = false;
    }
    inputBox.clearValue();
    inputBox.focus();
    screen.render();
}

export { handleCommand };
