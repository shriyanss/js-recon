"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chalk_1 = require("chalk");
var commandHelpers = {
    fetchMenu: function (chunks) {
        var returnText = chalk_1.default.cyan("List of chunks that contain fetch instances\n");
        for (var _i = 0, _a = Object.values(chunks); _i < _a.length; _i++) {
            var chunk = _a[_i];
            if (chunk.containsFetch) {
                returnText += chalk_1.default.green("- ".concat(chunk.id, ": ").concat(chunk.file, " (").concat(chunk.description, ")\n"));
            }
        }
        return returnText;
    },
    getFunctionCode: function (chunks, funcName) {
        var funcCode;
        for (var _i = 0, _a = Object.values(chunks); _i < _a.length; _i++) {
            var chunk = _a[_i];
            if (chunk.id == funcName) {
                funcCode = chunk.code;
            }
        }
        if (!funcCode) {
            return chalk_1.default.red("Function ".concat(funcName, " not found"));
        }
        return funcCode;
    },
    listAllFunctions: function (chunks) {
        var returnText = chalk_1.default.cyan("List of all functions\n");
        for (var _i = 0, _a = Object.values(chunks); _i < _a.length; _i++) {
            var chunk = _a[_i];
            returnText += chalk_1.default.green("- ".concat(chunk.id, ": ").concat(chunk.description, " (").concat(chunk.file, ")\n"));
        }
        return returnText;
    },
    navHistory: function (chunks, navList) {
        var returnText = chalk_1.default.cyan("Navigation history\n");
        if (navList.length === 0) {
            returnText += chalk_1.default.yellow("- No navigation history");
        }
        else {
            for (var _i = 0, navList_1 = navList; _i < navList_1.length; _i++) {
                var id = navList_1[_i];
                returnText += chalk_1.default.green("- ".concat(id, ": ").concat(chunks[id].description, "\n"));
            }
        }
        return returnText;
    },
    traceFunction: function (chunks, funcName) {
        var returnText = chalk_1.default.cyan("Tracing function ".concat(funcName, "\n"));
        var chunk = chunks[funcName];
        if (!chunk) {
            returnText += chalk_1.default.red("Function ".concat(funcName, " not found"));
        }
        else {
            // get imports
            if (chunk.imports.length === 0) {
                returnText += chalk_1.default.yellow("- No imports");
            }
            else {
                returnText += chalk_1.default.greenBright("Imports:\n");
                for (var _i = 0, _a = chunk.imports; _i < _a.length; _i++) {
                    var importName = _a[_i];
                    var funcDesc = chunks[importName].description;
                    returnText += chalk_1.default.green("- ".concat(importName, ": ").concat(funcDesc, "\n"));
                }
            }
        }
        return returnText;
    },
};
exports.default = commandHelpers;
