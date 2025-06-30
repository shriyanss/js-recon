import blessed from "blessed";
import chalk from "chalk";

const helpMenu = {
  help: "Show this help menu",
  exit: "Exit the interactive mode (or press escape twice)",
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
