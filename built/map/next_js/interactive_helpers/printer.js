"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printFunction = void 0;
var cli_highlight_1 = require("cli-highlight");
var fs_1 = require("fs");
// Function to print function code with syntax highlighting
var printFunction = function (outputBox, funcCode, funcDesc, funcWriteFile) {
    var rawText = "/**\n* ".concat(funcDesc, "\n*/\n").concat(funcCode);
    var highlighted = (0, cli_highlight_1.highlight)(rawText, {
        language: "javascript",
        ignoreIllegals: true,
        theme: undefined, // This makes cli-highlight use ANSI colors
    });
    outputBox.setContent(highlighted); // << use setContent instead of setText
    if (funcWriteFile) {
        fs_1.default.writeFileSync(funcWriteFile, rawText); // Save raw (non-colored) version to file
    }
};
exports.printFunction = printFunction;
