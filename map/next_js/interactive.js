import chalk from "chalk";
import blessed from "blessed";

let screen;
let output;
let input;

const log = {
  command: (text) => {
    output.pushLine(`${chalk.gray("> ")}${chalk.cyanBright(text)}`);
    screen.render();
  },
  info: (text) => {
    output.pushLine(`${chalk.gray("i ")}${chalk.blue(text)}`);
    screen.render();
  },
  error: (text) => {
    output.pushLine(`${chalk.red("! ")}${chalk.red(text)}`);
    screen.render();
  },
};

const interactive = async (chunks) => {
  console.log(chalk.cyan("[i] Entering 'interactive' module"));

  // Create a screen
  screen = blessed.screen({
    smartCSR: false,
    fullUnicode: true,
  });

  // Create a box for output
  output = blessed.box({
    top: 0,
    left: "center",
    width: "100%",
    height: "90%",
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    border: { type: "line" },
  });

  // Create input
  input = blessed.textbox({
    bottom: 0,
    height: 3,
    width: "100%",
    inputOnFocus: true,
    border: { type: "line" },
    style: {
      fg: "white",
      bg: "black",
      focus: { bg: "blue" },
    },
  });

  screen.append(output);
  screen.append(input);
  input.focus();

  input.on("submit", (value) => {
    log.command(value);
    if (value === "clear") {
      output.setContent("");
    } else if (value === "analyze") {
      log.info("Running analysis...");
      // hook your tool here
    } else if (value === "exit") {
      return screen.destroy();
    } else {
      log.error("Invalid command");
    }
    input.clearValue();
    input.focus();
    screen.render();
  });

  screen.key(["escape"], (ch, key) => {
    return screen.destroy();
  });

  screen.render();
};

export default interactive;
