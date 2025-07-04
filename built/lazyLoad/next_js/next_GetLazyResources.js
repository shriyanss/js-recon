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
var puppeteer_1 = require("puppeteer");
var parser_1 = require("@babel/parser");
var traverse_1 = require("@babel/traverse");
var traverse = traverse_1.default.default;
var inquirer_1 = require("inquirer");
var globalConfig_js_1 = require("../../globalConfig.js");
var makeReq_js_1 = require("../../utility/makeReq.js");
var runSandboxed_js_1 = require("../../utility/runSandboxed.js");
var globals_js_1 = require("../globals.js"); // Import js_urls functions
var globals = require("../../utility/globals.js");
/**
 * Asynchronously fetches the given URL and extracts JavaScript file URLs
 * from webpack's require.ensure() function.
 *
 * @param {string} url - The URL of the webpage to fetch and parse.
 * @returns {Promise<string[]|undefined>} - A promise that resolves to an array of
 * absolute URLs pointing to JavaScript files found in require.ensure()
 * functions, or undefined if no webpack JS is found.
 */
var next_getLazyResources = function (url) { return __awaiter(void 0, void 0, void 0, function () {
    var browser, page, webpack_js, _i, _a, js_url, res, webpack_js_source, ast, functions, user_verified, final_Func, _b, functions_1, func, askCorrectFuncConfirmation, urlBuilderFunc, js_paths, integers, _c, integers_1, i, output, final_urls, i, webpack_dir, js_path_dir, final_url;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, puppeteer_1.default.launch({
                    headless: true,
                })];
            case 1:
                browser = _d.sent();
                return [4 /*yield*/, browser.newPage()];
            case 2:
                page = _d.sent();
                return [4 /*yield*/, page.setRequestInterception(true)];
            case 3:
                _d.sent();
                page.on("request", function (request) { return __awaiter(void 0, void 0, void 0, function () {
                    var req_url;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                req_url = request.url();
                                // see if the request is a JS file, and is a get request
                                if (request.method() === "GET" &&
                                    req_url.match(/https?:\/\/[a-z\._\-]+\/.+\.js\??.*/)) {
                                    if (!(0, globals_js_1.getJsUrls)().includes(req_url)) {
                                        (0, globals_js_1.pushToJsUrls)(req_url);
                                    }
                                }
                                return [4 /*yield*/, request.continue()];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                return [4 /*yield*/, page.goto(url)];
            case 4:
                _d.sent();
                return [4 /*yield*/, browser.close()];
            case 5:
                _d.sent();
                // iterate through JS files
                for (_i = 0, _a = (0, globals_js_1.getJsUrls)(); _i < _a.length; _i++) {
                    js_url = _a[_i];
                    // match for webpack js file
                    if (js_url.match(/\/webpack.*\.js/)) {
                        console.log(chalk_1.default.green("[\u2713] Found webpack JS file at ".concat(js_url)));
                        webpack_js = js_url;
                    }
                }
                if (!webpack_js) {
                    console.log(chalk_1.default.red("[!] No webpack JS file found"));
                    console.log(chalk_1.default.magenta(globalConfig_js_1.default.notFoundMessage));
                    return [2 /*return*/]; // Return undefined as per JSDoc
                }
                return [4 /*yield*/, (0, makeReq_js_1.default)(webpack_js)];
            case 6:
                res = _d.sent();
                return [4 /*yield*/, res.text()];
            case 7:
                webpack_js_source = _d.sent();
                ast = parser_1.default.parse(webpack_js_source, {
                    sourceType: "unambiguous",
                    plugins: ["jsx", "typescript"],
                });
                functions = [];
                traverse(ast, {
                    FunctionDeclaration: function (path) {
                        var _a;
                        functions.push({
                            name: ((_a = path.node.id) === null || _a === void 0 ? void 0 : _a.name) || "(anonymous)",
                            type: "FunctionDeclaration",
                            source: webpack_js_source.slice(path.node.start, path.node.end),
                        });
                    },
                    FunctionExpression: function (path) {
                        var _a;
                        functions.push({
                            name: ((_a = path.parent.id) === null || _a === void 0 ? void 0 : _a.name) || "(anonymous)",
                            type: "FunctionExpression",
                            source: webpack_js_source.slice(path.node.start, path.node.end),
                        });
                    },
                    ArrowFunctionExpression: function (path) {
                        var _a;
                        functions.push({
                            name: ((_a = path.parent.id) === null || _a === void 0 ? void 0 : _a.name) || "(anonymous)",
                            type: "ArrowFunctionExpression",
                            source: webpack_js_source.slice(path.node.start, path.node.end),
                        });
                    },
                    ObjectMethod: function (path) {
                        functions.push({
                            name: path.node.key.name,
                            type: "ObjectMethod",
                            source: webpack_js_source.slice(path.node.start, path.node.end),
                        });
                    },
                    ClassMethod: function (path) {
                        functions.push({
                            name: path.node.key.name,
                            type: "ClassMethod",
                            source: webpack_js_source.slice(path.node.start, path.node.end),
                        });
                    },
                });
                user_verified = false;
                for (_b = 0, functions_1 = functions; _b < functions_1.length; _b++) {
                    func = functions_1[_b];
                    if (func.source.match(/"\.js".{0,15}$/)) {
                        console.log(chalk_1.default.green("[\u2713] Found JS chunk having the following source"));
                        console.log(chalk_1.default.yellow(func.source));
                        final_Func = func.source;
                    }
                }
                if (!final_Func) {
                    // Added check if final_Func was not found
                    console.log(chalk_1.default.red("[!] No suitable function found in webpack JS for lazy loading."));
                    return [2 /*return*/, []];
                }
                if (!!globals.getYes()) return [3 /*break*/, 9];
                askCorrectFuncConfirmation = function () { return __awaiter(void 0, void 0, void 0, function () {
                    var confirmed;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, inquirer_1.default.prompt([
                                    {
                                        type: "confirm",
                                        name: "confirmed",
                                        message: "Is this the correct function?",
                                        default: true,
                                    },
                                ])];
                            case 1:
                                confirmed = (_a.sent()).confirmed;
                                return [2 /*return*/, confirmed];
                        }
                    });
                }); };
                return [4 /*yield*/, askCorrectFuncConfirmation()];
            case 8:
                user_verified = _d.sent();
                if (user_verified === true) {
                    console.log(chalk_1.default.cyan("[i] Proceeding with the selected function to fetch files"));
                }
                else {
                    console.log(chalk_1.default.red("[!] Not executing function."));
                    return [2 /*return*/, []];
                }
                _d.label = 9;
            case 9:
                urlBuilderFunc = "(() => (".concat(final_Func, "))()");
                js_paths = [];
                try {
                    integers = final_Func.match(/\d+/g);
                    if (integers) {
                        // Check if integers were found
                        // iterate through all integers, and get the output
                        for (_c = 0, integers_1 = integers; _c < integers_1.length; _c++) {
                            i = integers_1[_c];
                            output = (0, runSandboxed_js_1.default)(urlBuilderFunc, parseInt(i));
                            if (output.includes("undefined")) {
                                continue;
                            }
                            else {
                                js_paths.push(output);
                            }
                        }
                    }
                }
                catch (err) {
                    console.error("Unsafe or invalid code:", err.message);
                    return [2 /*return*/, []];
                }
                if (js_paths.length > 0) {
                    console.log(chalk_1.default.green("[\u2713] Found ".concat(js_paths.length, " JS chunks")));
                }
                final_urls = [];
                for (i = 0; i < js_paths.length; i++) {
                    webpack_dir = webpack_js.split("/").slice(0, -1).join("/");
                    js_path_dir = js_paths[i].replace(/\/[a-zA-Z0-9\.]+\.js.*$/, "");
                    final_url = webpack_dir.replace(js_path_dir, js_paths[i]);
                    final_urls.push(final_url);
                }
                return [2 /*return*/, final_urls];
        }
    });
}); };
exports.default = next_getLazyResources;
