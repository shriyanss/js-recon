import blessed from "blessed";
import chalk from "chalk";

const helpMenu = {
  help: "Show this help menu",
  exit: "Exit the interactive mode (or press escape twice)",
  fetch: "Show list of chunks that contain fetch instances",
  func: "Show function code",
};

const fetchMenu = (chunks) => {
  let returnText = chalk.cyan("List of chunks that contain fetch instances\n");
  for (const chunk of Object.values(chunks)) {
    if (chunk.containsFetch) {
      returnText += chalk.green(`- ${chunk.id}: ${chunk.file}\n`);
    }
  }
  return returnText;
};

const getFunctionCode = (chunks, funcName) => {
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
};

const interactive = async (chunks) => {
  // store whether the last command was successful or not
  let lastCommandStatus = true;

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

    if (text === "exit") {
      return process.exit(0);
    } else if (text === "help") {
      for (const [key, value] of Object.entries(helpMenu)) {
        outputBox.log(chalk.cyan(`- '${key}': ${value}`));
      }
      lastCommandStatus = true;
    } else if (text === "fetch") {
      outputBox.log(fetchMenu(chunks));
      lastCommandStatus = true;
    } else if (text.startsWith("func")) {
      if (text.split(" ").length !== 2) {
        outputBox.log(chalk.magenta("Usage: func <function_name>"));
        lastCommandStatus = false;
      } else {
        const funcName = text.split(" ")[1];
        const funcCode = getFunctionCode(chunks, funcName);
        outputBox.log(funcCode);
        lastCommandStatus = true;
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
  screen.key(["escape"], () => {
    return process.exit(0);
  });

  // Initial render
  screen.render();
};

export default interactive;
