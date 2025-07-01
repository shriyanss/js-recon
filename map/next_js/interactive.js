import blessed from "blessed";
import chalk from "chalk";

const helpMenu = {
  help: "Show this help menu",
  exit: "Exit the interactive mode (or press escape twice)",
  list: "Show list of chunks",
  go: "Go to a specific function",
};

const commandHelpers = {
  fetchMenu: (chunks) => {
    let returnText = chalk.cyan(
      "List of chunks that contain fetch instances\n"
    );
    for (const chunk of Object.values(chunks)) {
      if (chunk.containsFetch) {
        returnText += chalk.green(`- ${chunk.id}: ${chunk.file} (${chunk.description})\n`);
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
      returnText += chalk.green(`- ${chunk.id}: ${chunk.description} (${chunk.file})\n`);
    }
    return returnText;
  },
};

const interactive = async (chunks) => {
  // store whether the last command was successful or not
  let lastCommandStatus = true;
  let functionNavHistory = [];
  let functionNavHistoryIndex = -1;

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

  // Handle input submission
  inputBox.on("submit", (text) => {
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
      if (text.split(" ").length < 2) {
        outputBox.log(
          chalk.magenta(
            "Usage: list <options>\nlist fetch: List functions that contain fetch instances\nlist all: List all functions"
          )
        );
        lastCommandStatus = false;
      } else {
        const option = text.split(" ")[1];
        if (option === "fetch") {
          outputBox.log(commandHelpers.fetchMenu(chunks));
          lastCommandStatus = true;
        } else if (option === "all") {
          outputBox.log(commandHelpers.listAllFunctions(chunks));
          lastCommandStatus = true;
        } else {
          outputBox.log(chalk.red(option), "is not a valid option");
          lastCommandStatus = false;
        }
      }
    } else if (text.startsWith("go")) {
      if (text.split(" ").length < 2) {
        outputBox.log(chalk.magenta("Usage: go <options>\ngo to <functionID>"));
        lastCommandStatus = false;
      } else {
        const funcName = text.split(" ")[1];
        if (funcName === "to") {
          const funcId = text.split(" ")[2];
          const funcCode = commandHelpers.getFunctionCode(chunks, funcId);
          outputBox.setText(funcCode);
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
              outputBox.setText(funcCode);
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
              outputBox.setText(funcCode);
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

  // Quit on Escape
  inputBox.key(["escape"], () => {
    return process.exit(0);
  });

  // Initial render
  screen.render();
};

export default interactive;
