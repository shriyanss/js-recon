import { createUI } from "./interactive_helpers/ui.js";
import { handleCommand } from "./interactive_helpers/commandHandler.js";
import { setupKeybindings } from "./interactive_helpers/keybindings.js";
import { Chunks } from "../../utility/interfaces.js";

export interface State {
    chunks: Chunks;
    lastCommandStatus: boolean;
    functionNavHistory: string[];
    functionNavHistoryIndex: number;
    funcWriteFile: string|undefined;
    commandHistory: string[];
    commandHistoryIndex: number;
    writeimports: boolean;
}

const interactive = async (chunks:Chunks) => {
    const state = {
        chunks,
        lastCommandStatus: true,
        functionNavHistory: [],
        functionNavHistoryIndex: -1,
        funcWriteFile: undefined,
        commandHistory: [],
        commandHistoryIndex: -1,
        writeimports: true,
    };

    const ui = createUI();

    ui.inputBox.on("submit", (text:string) => {
        handleCommand(text, state, ui);
    });

    setupKeybindings(ui.screen, ui.inputBox, ui.outputBox, state);

    ui.inputBox.focus();
    ui.screen.render();
};

export default interactive;
