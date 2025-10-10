import { createUI } from "./interactive_helpers/ui.js";
import { handleCommand } from "./interactive_helpers/commandHandler.js";
import { setupKeybindings } from "./interactive_helpers/keybindings.js";
import { Chunks } from "../../utility/interfaces.js";

export interface State {
    chunks: Chunks;
    lastCommandStatus: boolean;
    functionNavHistory: string[];
    functionNavHistoryIndex: number;
    funcWriteFile: string | undefined;
    commandHistory: string[];
    commandHistoryIndex: number;
    writeimports: boolean;
    mapFile: string;
}

/**
 * Starts the interactive mode.
 * @param {Chunks} chunks - A dictionary of chunk names to chunk objects.
 * @param {string} map_file - The name of the map file.
 */
const interactive = async (chunks: Chunks, map_file: string) => {
    const state = {
        chunks,
        lastCommandStatus: true,
        functionNavHistory: [],
        functionNavHistoryIndex: -1,
        funcWriteFile: undefined,
        commandHistory: [],
        commandHistoryIndex: -1,
        writeimports: false,
        mapFile: map_file,
    };

    const ui = createUI();

    ui.inputBox.on("submit", async (text: string) => {
        await handleCommand(text, state, ui);
    });

    setupKeybindings(ui.screen, ui.inputBox, ui.outputBox, state);

    ui.inputBox.focus();
    ui.screen.render();
};

export default interactive;
