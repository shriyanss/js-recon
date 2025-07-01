import { createUI } from "./interactive_helpers/ui.js";
import { handleCommand } from "./interactive_helpers/commandHandler.js";
import { setupKeybindings } from "./interactive_helpers/keybindings.js";

const interactive = async (chunks) => {
  const state = {
    chunks,
    lastCommandStatus: true,
    functionNavHistory: [],
    functionNavHistoryIndex: -1,
    funcWriteFile: undefined,
    commandHistory: [],
    commandHistoryIndex: -1,
  };

  const ui = createUI();

  ui.inputBox.on("submit", (text) => {
    handleCommand(text, state, ui);
  });

  setupKeybindings(ui.screen, ui.inputBox, ui.outputBox, state);

  ui.inputBox.focus();
  ui.screen.render();
};

export default interactive;
