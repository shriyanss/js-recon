"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCommand = handleCommand;
var chalk_1 = require("chalk");
var path_1 = require("path");
var commandHelpers_js_1 = require("./commandHelpers.js");
var helpMenu_js_1 = require("./helpMenu.js");
var printer_js_1 = require("./printer.js");
function handleCommand(text, state, ui) {
    var chunks = state.chunks;
    var outputBox = ui.outputBox, inputBox = ui.inputBox, screen = ui.screen;
    if (text !== "" &&
        !text.match(/^\s+$/) &&
        text !== state.commandHistory[state.commandHistory.length - 1]) {
        state.commandHistory.push(text);
        state.commandHistoryIndex = state.commandHistory.length;
    }
    if (state.lastCommandStatus) {
        outputBox.log("".concat(chalk_1.default.bgGreenBright("%"), " ").concat(text));
    }
    else {
        outputBox.log("".concat(chalk_1.default.bgRed("%"), " ").concat(text));
    }
    if (text === "") {
        state.lastCommandStatus = true;
    }
    else if (text === "exit") {
        return process.exit(0);
    }
    else if (text === "help") {
        var helpText = chalk_1.default.cyan("Available commands:\n");
        for (var _i = 0, _a = Object.entries(helpMenu_js_1.helpMenu); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            helpText += chalk_1.default.green("\n".concat(key, ":\n"));
            helpText += "  ".concat(value.replace(/\n/g, "\n  "), "\n");
        }
        outputBox.log(helpText);
        state.lastCommandStatus = true;
    }
    else if (text.startsWith("list")) {
        var usage = helpMenu_js_1.helpMenu.list;
        if (text.split(" ").length < 2) {
            outputBox.log(chalk_1.default.magenta(usage));
            state.lastCommandStatus = false;
        }
        else {
            var option = text.split(" ")[1];
            if (option === "") {
                outputBox.log(chalk_1.default.magenta(usage));
                state.lastCommandStatus = false;
            }
            else if (option === "fetch") {
                outputBox.log(commandHelpers_js_1.default.fetchMenu(chunks));
                state.lastCommandStatus = true;
            }
            else if (option === "all") {
                outputBox.log(commandHelpers_js_1.default.listAllFunctions(chunks));
                state.lastCommandStatus = true;
            }
            else if (option === "nav") {
                outputBox.log(commandHelpers_js_1.default.navHistory(chunks, state.functionNavHistory));
                state.lastCommandStatus = true;
            }
            else {
                outputBox.log(chalk_1.default.red(option), "is not a valid option");
                state.lastCommandStatus = false;
            }
        }
    }
    else if (text.startsWith("go")) {
        var usage = helpMenu_js_1.helpMenu.go;
        if (text.split(" ").length < 2) {
            outputBox.log(chalk_1.default.magenta(usage));
            state.lastCommandStatus = false;
        }
        else {
            var funcName = text.split(" ")[1];
            if (funcName === "") {
                outputBox.log(chalk_1.default.magenta(usage));
                state.lastCommandStatus = false;
            }
            else if (funcName === "to") {
                var funcId = text.split(" ")[2];
                var funcCode = commandHelpers_js_1.default.getFunctionCode(chunks, funcId);
                (0, printer_js_1.printFunction)(outputBox, funcCode, chunks[funcId].description, state.funcWriteFile);
                state.lastCommandStatus = true;
                state.functionNavHistory.push(funcId);
                state.functionNavHistoryIndex++;
            }
            else if (funcName === "back") {
                if (state.functionNavHistory.length > 0) {
                    if (state.functionNavHistoryIndex > 0) {
                        state.functionNavHistoryIndex--;
                        var funcId = state.functionNavHistory[state.functionNavHistoryIndex];
                        var funcCode = commandHelpers_js_1.default.getFunctionCode(chunks, funcId);
                        (0, printer_js_1.printFunction)(outputBox, funcCode, chunks[funcId].description, state.funcWriteFile);
                        state.lastCommandStatus = true;
                    }
                    else {
                        outputBox.log(chalk_1.default.red("No previous function found"));
                        state.lastCommandStatus = false;
                    }
                }
                else {
                    outputBox.log(chalk_1.default.red("No previous function found"));
                    state.lastCommandStatus = false;
                }
            }
            else if (funcName === "ahead") {
                if (state.functionNavHistory.length > 0) {
                    if (state.functionNavHistoryIndex <
                        state.functionNavHistory.length - 1) {
                        state.functionNavHistoryIndex++;
                        var funcId = state.functionNavHistory[state.functionNavHistoryIndex];
                        var funcCode = commandHelpers_js_1.default.getFunctionCode(chunks, funcId);
                        (0, printer_js_1.printFunction)(outputBox, funcCode, chunks[funcId].description, state.funcWriteFile);
                        state.lastCommandStatus = true;
                    }
                    else {
                        outputBox.log(chalk_1.default.red("No next function found"));
                        state.lastCommandStatus = false;
                    }
                }
                else {
                    outputBox.log(chalk_1.default.red("No next function found"));
                    state.lastCommandStatus = false;
                }
            }
            else {
                outputBox.log(chalk_1.default.red(funcName), "is not a valid option");
                state.lastCommandStatus = false;
            }
        }
    }
    else if (text === "clear") {
        outputBox.setText("");
        state.lastCommandStatus = true;
    }
    else if (text.startsWith("set")) {
        if (text.split(" ").length < 3) {
            outputBox.log(chalk_1.default.magenta(helpMenu_js_1.helpMenu.set));
            state.lastCommandStatus = false;
        }
        else {
            var option = text.split(" ")[1];
            if (option === "funcwritefile") {
                var fileName = text.split(" ")[2];
                state.funcWriteFile = path_1.default.join("".concat(fileName));
                outputBox.log(chalk_1.default.green("Function write file set to ".concat(state.funcWriteFile)));
                state.lastCommandStatus = true;
            }
            else {
                outputBox.log(chalk_1.default.red(option), "is not a valid option");
                state.lastCommandStatus = false;
            }
        }
    }
    else if (text.startsWith("trace")) {
        var usage = helpMenu_js_1.helpMenu.trace;
        if (text.split(" ").length < 2) {
            outputBox.log(chalk_1.default.magenta(usage));
            state.lastCommandStatus = false;
        }
        else {
            var option = text.split(" ")[1];
            if (option === "") {
                outputBox.log(chalk_1.default.magenta(usage));
                state.lastCommandStatus = false;
            }
            else {
                var funcName = text.split(" ")[1];
                outputBox.log(commandHelpers_js_1.default.traceFunction(chunks, funcName));
                state.lastCommandStatus = true;
            }
        }
    }
    else {
        outputBox.log(chalk_1.default.red(text), "is not a valid command");
        state.lastCommandStatus = false;
    }
    inputBox.clearValue();
    inputBox.focus();
    screen.render();
}
