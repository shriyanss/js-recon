"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("ses");
// Lock down the global environment for security
lockdown();
/**
 * Executes a given function in a sandboxed environment.
 * @param {string} code - The code to execute.
 * @param {any} param - The parameter to pass to the function.
 * @returns {any} The result of the function execution.
 */
var execFunc = function (code, param) {
    var c = new Compartment({
        console: console,
    });
    var wrappedCode = "\n    (".concat(code, ")\n  ");
    var func = c.evaluate(wrappedCode);
    var output = func(param);
    return output;
};
exports.default = execFunc;
