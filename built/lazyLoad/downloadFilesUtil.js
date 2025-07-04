"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var chalk_1 = require("chalk");
var path_1 = require("path");
var fs_1 = require("fs");
var prettier_1 = require("prettier");
var makeReq_js_1 = require("../utility/makeReq.js");
var urlUtils_js_1 = require("../utility/urlUtils.js");
var globals_js_1 = require("./globals.js"); // Import scope and max_req_queue functions
/**
 * Downloads a list of URLs and saves them as files in the specified output directory.
 * It creates the necessary subdirectories based on the URL's host and path.
 * If the URL does not end with `.js`, it is skipped.
 * The function logs the progress and any errors to the console.
 * @param {string[]} urls - An array of URLs to be downloaded.
 * @param {string} output - The directory where the downloaded files will be saved.
 * @returns {Promise<void>}
 */
var downloadFiles = function (urls, output) { return __awaiter(void 0, void 0, void 0, function () {
    var ignoredJSFiles, ignoredJSDomains, download_count, queue, downloadPromises;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log(chalk_1.default.cyan("[i] Attempting to download ".concat(urls.length, " JS chunks")));
                fs_1.default.mkdirSync(output, { recursive: true });
                ignoredJSFiles = [];
                ignoredJSDomains = [];
                download_count = 0;
                queue = 0;
                downloadPromises = urls.map(function (url) { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, host, directory, childDir, res, err_1, file, _b, _c, filename, chunks, _i, chunks_1, chunk, filePath, _d, _e, _f, err_2, err_3;
                    return __generator(this, function (_g) {
                        switch (_g.label) {
                            case 0:
                                _g.trys.push([0, 16, , 17]);
                                return [4 /*yield*/, new Promise(function (resolve) {
                                        return setTimeout(resolve, Math.random() * 4950 + 50);
                                    })];
                            case 1:
                                _g.sent();
                                if (!url.match(/\.js/)) return [3 /*break*/, 15];
                                _a = (0, urlUtils_js_1.getURLDirectory)(url), host = _a.host, directory = _a.directory;
                                // check scope of file. Only if in scope, download it
                                if (!(0, globals_js_1.getScope)().includes("*")) {
                                    if (!(0, globals_js_1.getScope)().includes(host)) {
                                        ignoredJSFiles.push(url);
                                        if (!ignoredJSDomains.includes(host)) {
                                            ignoredJSDomains.push(host);
                                        }
                                        return [2 /*return*/];
                                    }
                                }
                                childDir = path_1.default.join(output, host, directory);
                                fs_1.default.mkdirSync(childDir, { recursive: true });
                                res = void 0;
                                _g.label = 2;
                            case 2:
                                _g.trys.push([2, 7, 8, 9]);
                                _g.label = 3;
                            case 3:
                                if (!(queue >= (0, globals_js_1.getMaxReqQueue)())) return [3 /*break*/, 5];
                                return [4 /*yield*/, new Promise(function (resolve) {
                                        return setTimeout(resolve, Math.random() * 250 + 50);
                                    })];
                            case 4:
                                _g.sent();
                                return [3 /*break*/, 3];
                            case 5:
                                queue++; // acquire a slot in the queue
                                return [4 /*yield*/, (0, makeReq_js_1.default)(url)];
                            case 6:
                                res = _g.sent();
                                return [3 /*break*/, 9];
                            case 7:
                                err_1 = _g.sent();
                                console.error(chalk_1.default.red("[!] Failed to download: ".concat(url)));
                                return [3 /*break*/, 9];
                            case 8:
                                queue--;
                                return [7 /*endfinally*/];
                            case 9:
                                _c = (_b = "// JS Source: ".concat(url, "\n")).concat;
                                return [4 /*yield*/, res.text()];
                            case 10:
                                file = _c.apply(_b, [_g.sent()]);
                                filename = void 0;
                                try {
                                    filename = url
                                        .split("/")
                                        .pop()
                                        .match(/[a-zA-Z0-9\.\-_]+\.js/)[0];
                                }
                                catch (err) {
                                    chunks = url.split("/");
                                    for (_i = 0, chunks_1 = chunks; _i < chunks_1.length; _i++) {
                                        chunk = chunks_1[_i];
                                        if (chunk.match(/\.js$/)) {
                                            filename = chunk;
                                            break;
                                        }
                                    }
                                }
                                if (!filename) {
                                    // Handle cases where filename might not be found
                                    console.warn(chalk_1.default.yellow("[!] Could not determine filename for URL: ".concat(url, ". Skipping.")));
                                    return [2 /*return*/];
                                }
                                filePath = path_1.default.join(childDir, filename);
                                _g.label = 11;
                            case 11:
                                _g.trys.push([11, 13, , 14]);
                                _e = (_d = fs_1.default).writeFileSync;
                                _f = [filePath];
                                return [4 /*yield*/, prettier_1.default.format(file, { parser: "babel" })];
                            case 12:
                                _e.apply(_d, _f.concat([_g.sent()]));
                                return [3 /*break*/, 14];
                            case 13:
                                err_2 = _g.sent();
                                console.error(chalk_1.default.red("[!] Failed to write file: ".concat(filePath)));
                                return [3 /*break*/, 14];
                            case 14:
                                download_count++;
                                _g.label = 15;
                            case 15: return [3 /*break*/, 17];
                            case 16:
                                err_3 = _g.sent();
                                console.error(chalk_1.default.red("[!] Failed to download: ".concat(url)));
                                return [3 /*break*/, 17];
                            case 17: return [2 /*return*/];
                        }
                    });
                }); });
                return [4 /*yield*/, Promise.all(downloadPromises)];
            case 1:
                _a.sent();
                if (ignoredJSFiles.length > 0) {
                    console.log(chalk_1.default.yellow("[i] Ignored ".concat(ignoredJSFiles.length, " JS files across ").concat(ignoredJSDomains.length, " domain(s) - ").concat(ignoredJSDomains.join(", "))));
                }
                if (download_count > 0) {
                    console.log(chalk_1.default.green("[\u2713] Downloaded ".concat(download_count, " JS chunks to ").concat(output, " directory")));
                }
                return [2 /*return*/];
        }
    });
}); };
exports.default = downloadFiles;
