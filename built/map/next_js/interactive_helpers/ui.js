"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUI = createUI;
var blessed_1 = require("blessed");
function createUI() {
    // Create a screen object.
    var screen = blessed_1.default.screen({
        smartCSR: true,
        title: "JS Recon Interactive Mode",
        fullUnicode: true,
    });
    // Title Box
    var titleBox = blessed_1.default.box({
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
    var outputBox = blessed_1.default.log({
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
    var inputBox = blessed_1.default.textbox({
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
    return { screen: screen, titleBox: titleBox, outputBox: outputBox, inputBox: inputBox };
}
