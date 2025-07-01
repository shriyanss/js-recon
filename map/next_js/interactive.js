import blessed from "blessed";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { highlight } from "cli-highlight";

const helpMenu = {
  help: "Show this help menu",
  exit: "Exit the interactive mode (or press escape twice)",
  list: "Show list of chunks",
  go: "Go to a specific function",
  set: "Set options",
};

const commandHelpers = {
  fetchMenu: (chunks) => {
    let returnText = chalk.cyan(
      "List of chunks that contain fetch instances\n"
    );
    for (const chunk of Object.values(chunks)) {
      if (chunk.containsFetch) {
        returnText += chalk.green(
          `- ${chunk.id}: ${chunk.file} (${chunk.description})\n`
        );
      }
    }
    return returnText;
  },
  getFunctionCode: (chunks, funcName) => {
    let funcCode;
    for (const chunk of Object.values(chunks)) {
      if (chunk.id == funcName) {
        funcCode = chunk.code;
      }
    }
    if (!funcCode) {
      return chalk.red(`Function ${funcName} not found`);
    }
    return funcCode;
  },
  listAllFunctions: (chunks) => {
    let returnText = chalk.cyan("List of all functions\n");
    for (const chunk of Object.values(chunks)) {
      returnText += chalk.green(
        `- ${chunk.id}: ${chunk.description} (${chunk.file})\n`
      );
    }
    return returnText;
  },
  navHistory: (chunks, navList) => {
    let returnText = chalk.cyan("Navigation history\n");
    if (navList.length === 0) {
      returnText += chalk.yellow("- No navigation history");
    } else {
      for (const id of navList) {
        returnText += chalk.green(`- ${id}: ${chunks[id].description}\n`);
      }
    }
    return returnText;
  },
  traceFunction: (chunks, funcName) => {
    let returnText = chalk.cyan(`Tracing function ${funcName}\n`);
    const chunk = chunks[funcName];
    if (!chunk) {
      returnText += chalk.red(`Function ${funcName} not found`);
    } else {
      // get imports
      if (chunk.imports.length === 0) {
        returnText += chalk.yellow("- No imports");
      } else {
        for (const importName of chunk.imports) {
          const funcDesc = chunks[importName].description;
          returnText += chalk.green(`- ${importName}: ${funcDesc}\n`);
        }
      }
    }
    return returnText;
  },
};

const interactive = async (chunks) => {
  // store whether the last command was successful or not
  let lastCommandStatus = true;
  let functionNavHistory = [];
  let functionNavHistoryIndex = -1;
  let funcWriteFile = undefined;
  let commandHistory = [];
  let commandHistoryIndex = -1;

  // Create a screen object.
  const screen = blessed.screen({
    smartCSR: true,
    title: "JS Recon Interactive Mode",
    fullUnicode: true,
  });

  // Title Box
  const titleBox = blessed.box({
    parent: screen,
    top: 0,
    left: "center",
    width: "98%",
    height: 3,
    content: "JS Recon Interactive Mode",
    border: {
      type: "line",
    },
    style: {
      fg: "white",
      border: {
        fg: "gray",
      },
    },
  });

  // Output Box
  const outputBox = blessed.log({
    parent: screen,
    top: 3,
    left: "center",
    width: "98%",
    bottom: 3,
    border: {
      type: "line",
    },
    style: {
      fg: "white",
      border: {
        fg: "gray",
      },
    },
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: " ",
      inverse: true,
    },
    keys: true,
    vi: true,
    mouse: true,
    scrollSpeed: 0.5,
  });

  // Input Box
  const inputBox = blessed.textbox({
    parent: screen,
    bottom: 0,
    left: "center",
    width: "98%",
    height: 3,
    border: {
      type: "line",
    },
    style: {
      fg: "white",
      bg: "black",
      border: {
        fg: "gray",
      },
      focus: {
        border: {
          fg: "blue",
        },
      },
    },
    inputOnFocus: true,
  });

  // Function to print function code with syntax highlighting
  const printFunction = (funcCode, funcDesc) => {
    const rawText = `/**\n* ${funcDesc}\n*/\n${funcCode}`;
    const highlighted = highlight(rawText, {
      language: "javascript",
      ignoreIllegals: true,
      theme: undefined, // This makes cli-highlight use ANSI colors
    });

    outputBox.setContent(highlighted); // << use setContent instead of setText

    if (funcWriteFile) {
      fs.writeFileSync(funcWriteFile, rawText); // Save raw (non-colored) version to file
    }
  };

  // Handle input submission
  inputBox.on("submit", (text) => {
    if (
      text !== "" &&
      !text.match(/^\s+$/) &&
      text !== commandHistory[commandHistory.length - 1]
    ) {
      commandHistory.push(text);
      commandHistoryIndex = commandHistory.length;
    }
    if (lastCommandStatus) {
      outputBox.log(`${chalk.bgGreenBright("%")} ${text}`);
    } else {
      outputBox.log(`${chalk.bgRed("%")} ${text}`);
    }

    if (text === "") {
      lastCommandStatus = true;
    } else if (text === "exit") {
      return process.exit(0);
    } else if (text === "help") {
      for (const [key, value] of Object.entries(helpMenu)) {
        outputBox.log(chalk.cyan(`- '${key}': ${value}`));
      }
      lastCommandStatus = true;
    } else if (text.startsWith("list")) {
      const usage =
        "Usage: list <options>\nlist fetch: List functions that contain fetch instances\nlist all: List all functions";
      if (text.split(" ").length < 2) {
        outputBox.log(chalk.magenta(usage));
        lastCommandStatus = false;
      } else {
        const option = text.split(" ")[1];

        if (option === "") {
          outputBox.log(chalk.magenta(usage));
          lastCommandStatus = false;
        } else if (option === "fetch") {
          outputBox.log(commandHelpers.fetchMenu(chunks));
          lastCommandStatus = true;
        } else if (option === "all") {
          outputBox.log(commandHelpers.listAllFunctions(chunks));
          lastCommandStatus = true;
        } else if (option === "nav") {
          outputBox.log(commandHelpers.navHistory(chunks, functionNavHistory));
          lastCommandStatus = true;
        } else {
          outputBox.log(chalk.red(option), "is not a valid option");
          lastCommandStatus = false;
        }
      }
    } else if (text.startsWith("go")) {
      const usage =
        "Usage: go <options>\ngo to <functionID>\ngo back: Go back to the previous function\ngo ahead: Go to the next function";
      if (text.split(" ").length < 2) {
        outputBox.log(chalk.magenta(usage));
        lastCommandStatus = false;
      } else {
        const funcName = text.split(" ")[1];
        if (funcName === "") {
          outputBox.log(chalk.magenta(usage));
          lastCommandStatus = false;
        } else if (funcName === "to") {
          const funcId = text.split(" ")[2];
          const funcCode = commandHelpers.getFunctionCode(chunks, funcId);
          printFunction(funcCode, chunks[funcId].description);
          lastCommandStatus = true;
          functionNavHistory.push(funcId);
          functionNavHistoryIndex++;
        } else if (funcName === "back") {
          // check if the user has navigated to any function
          if (functionNavHistory.length > 0) {
            // check if this is the last checked function
            if (functionNavHistoryIndex > 0) {
              functionNavHistoryIndex--;
              const funcId = functionNavHistory[functionNavHistoryIndex];
              const funcCode = commandHelpers.getFunctionCode(chunks, funcId);
              printFunction(funcCode, chunks[funcId].description);
              lastCommandStatus = true;
            } else {
              // user is already at the first function
              outputBox.log(chalk.red("No previous function found"));
              lastCommandStatus = false;
            }
          } else {
            // user has not navigated to any function
            outputBox.log(chalk.red("No previous function found"));
            lastCommandStatus = false;
          }
        } else if (funcName === "ahead") {
          // check if the user has navigated to any function
          if (functionNavHistory.length > 0) {
            // check if this is the last checked function
            if (functionNavHistoryIndex < functionNavHistory.length - 1) {
              functionNavHistoryIndex++;
              const funcId = functionNavHistory[functionNavHistoryIndex];
              const funcCode = commandHelpers.getFunctionCode(chunks, funcId);
              printFunction(funcCode, chunks[funcId].description);
              lastCommandStatus = true;
            } else {
              // user is already at the last function
              outputBox.log(chalk.red("No next function found"));
              lastCommandStatus = false;
            }
          } else {
            // user has not navigated to any function
            outputBox.log(chalk.red("No next function found"));
            lastCommandStatus = false;
          }
        } else {
          outputBox.log(chalk.red(funcName), "is not a valid option");
          lastCommandStatus = false;
        }
      }
    } else if (text === "clear") {
      outputBox.setText("");
      lastCommandStatus = true;
    } else if (text.startsWith("set")) {
      if (text.split(" ").length < 3) {
        outputBox.log(
          chalk.magenta("Usage: set <options>\nset funcwritefile <filename>")
        );
        lastCommandStatus = false;
      } else {
        const option = text.split(" ")[1];
        if (option === "funcwritefile") {
          const fileName = text.split(" ")[2];
          funcWriteFile = path.join(`${fileName}`);
          outputBox.log(
            chalk.green(`Function write file set to ${funcWriteFile}`)
          );
          lastCommandStatus = true;
        } else {
          outputBox.log(chalk.red(option), "is not a valid option");
          lastCommandStatus = false;
        }
      }
    } else if (text.startsWith("trace")) {
      const usage = "Usage: trace <options>\ntrace <functionName>";
      if (text.split(" ").length < 2) {
        outputBox.log(chalk.magenta(usage));
        lastCommandStatus = false;
      } else {
        const option = text.split(" ")[1];
        if (option === "") {
          outputBox.log(chalk.magenta(usage));
          lastCommandStatus = false;
        } else {
          const funcName = text.split(" ")[1];
          outputBox.log(commandHelpers.traceFunction(chunks, funcName));
          lastCommandStatus = true;
        }
      }
    } else {
      outputBox.log(chalk.red(text), "is not a valid command");
      lastCommandStatus = false;
    }
    inputBox.clearValue();
    inputBox.focus();
    screen.render();
  });

  // Focus the input box
  inputBox.focus();

  // Quit on ctl-c
  screen.key(["C-c"], () => {
    return process.exit(0);
  });

  // on pressing esc on input, focus on output
  inputBox.key(["escape"], () => {
    outputBox.focus();
    outputBox.style.border.fg = "blue";
    inputBox.style.border.fg = "gray";
    screen.render();
  });

  // Clear input box on ctl-c
  inputBox.key(["C-c"], () => {
    outputBox.log(chalk.yellow("^C (Use Esc then C-c to exit)"));
    inputBox.focus();
    lastCommandStatus = false;
    screen.render();
  });

  // on pressing 's' on screen, focus on output box, and thicken the border
  screen.key(["o"], () => {
    outputBox.focus();
    outputBox.style.border.fg = "blue";
    inputBox.style.border.fg = "gray";
    screen.render();
  });

  // on pressing 'i' on screen, focus on input box
  screen.key(["i"], () => {
    inputBox.focus();
    inputBox.style.border.fg = "blue";
    outputBox.style.border.fg = "gray";
    screen.render();
  });

  // on pressing arrow keys on output box, scroll the output
  outputBox.key(["up", "down"], (ch, key) => {
    outputBox.scroll(key.name === "up" ? -1 : 1);
    screen.render();
  });

  // on pressing arrow keys on input box, navigate through command history
  inputBox.key(["up", "down"], (ch, key) => {
    if (key.name === "up") {
      if (commandHistoryIndex > 0) {
        commandHistoryIndex--;
        inputBox.setValue(commandHistory[commandHistoryIndex]);
      } else {
        // blink the border with red once
        inputBox.style.border.fg = "red";
        setTimeout(() => {
          inputBox.style.border.fg = "blue";
          screen.render();
        }, 100);
      }
    } else if (key.name === "down") {
      if (commandHistoryIndex < commandHistory.length - 1) {
        commandHistoryIndex++;
        inputBox.setValue(commandHistory[commandHistoryIndex]);
      } else {
        // blink the border with red once
        inputBox.style.border.fg = "red";
        commandHistoryIndex = commandHistory.length;
        inputBox.setValue("");
        setTimeout(() => {
          inputBox.style.border.fg = "blue";
          screen.render();
        }, 100);
      }
    }
    screen.render();
  });

  // Initial render
  screen.render();
};

export default interactive;
