"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var githubURL = "https://github.com/shriyanss/js-recon";
var version = "1.0.0";
var toolDesc = "JS Recon Tool";
global.CONFIG = {
    github: githubURL,
    notFoundMessage: "If you believe this is an error or is a new technology, please create an issue on ".concat(githubURL, " and we'll figure it out for you"),
    version: version,
    toolDesc: toolDesc,
};
exports.default = global.CONFIG;
