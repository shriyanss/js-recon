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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var chalk_1 = require("chalk");
var fs_1 = require("fs");
var path_1 = require("path");
var urlUtils_js_1 = require("../../utility/urlUtils.js");
// custom request module
var makeReq_js_1 = require("../../utility/makeReq.js");
var queue = [];
var max_queue;
/**
 * Given a string of JS content, it finds all the static files used in the
 * file, and returns them as an array.
 *
 * @param {string} js_content - The string of JS content to search through.
 *
 * @returns {string[]} An array of strings, each string being a static file
 * path.
 */
var findStaticFiles = function (js_content) { return __awaiter(void 0, void 0, void 0, function () {
    var matches, toReturn, _i, matches_1, match;
    return __generator(this, function (_a) {
        matches = __spreadArray([], js_content.matchAll(/\/?static\/chunks\/[a-zA-Z0-9\._\-\/]+\.js/g), true);
        toReturn = [];
        for (_i = 0, matches_1 = matches; _i < matches_1.length; _i++) {
            match = matches_1[_i];
            toReturn.push(match[0]);
        }
        return [2 /*return*/, toReturn];
    });
}); };
var getURLDirectoryServer = function (urlString) {
    var url = new URL(urlString);
    var pathParts = url.pathname.split("/").filter(Boolean); // ['business', 'api']
    pathParts.pop(); // Remove 'api'
    var newPath = "/" + pathParts.join("/"); // '/business'
    return "".concat(url.origin).concat(newPath); // 'http://something.com/business'
};
var subsequentRequests = function (url, urlsFile, threads, output, js_urls) { return __awaiter(void 0, void 0, void 0, function () {
    var staticJSURLs, endpoints, js_contents, reqPromises;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                max_queue = threads;
                staticJSURLs = [];
                console.log(chalk_1.default.cyan("[i] Fetching JS files from subsequent requests"));
                // open the urls file, and load the paths (JSON)
                if (!fs_1.default.existsSync(urlsFile)) {
                    console.log(chalk_1.default.red("[!] URLs file ".concat(urlsFile, " does not exist")));
                    console.log(chalk_1.default.yellow("[!] Please run strings module first with -e flag"));
                    console.log(chalk_1.default.yellow("[!] Example: js-recon strings -d <directory> -e"));
                    process.exit(1);
                }
                endpoints = JSON.parse(fs_1.default.readFileSync(urlsFile, "utf8")).paths;
                js_contents = {};
                reqPromises = endpoints.map(function (endpoint) { return __awaiter(void 0, void 0, void 0, function () {
                    var reqUrl, res, text, _a, host, directory, output_path, staticFiles, absolutePaths, newPaths, e_1;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                reqUrl = new URL(endpoint, url).href;
                                _b.label = 1;
                            case 1:
                                _b.trys.push([1, 9, , 10]);
                                _b.label = 2;
                            case 2:
                                if (!(queue >= max_queue)) return [3 /*break*/, 4];
                                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 100); })];
                            case 3:
                                _b.sent();
                                return [3 /*break*/, 2];
                            case 4:
                                queue++;
                                return [4 /*yield*/, (0, makeReq_js_1.default)(reqUrl, {
                                        headers: {
                                            RSC: "1",
                                        },
                                    })];
                            case 5:
                                res = _b.sent();
                                if (!(res &&
                                    res.status === 200 &&
                                    res.headers.get("content-type").includes("text/x-component"))) return [3 /*break*/, 8];
                                return [4 /*yield*/, res.text()];
                            case 6:
                                text = _b.sent();
                                js_contents[endpoint] = text;
                                _a = (0, urlUtils_js_1.getURLDirectory)(reqUrl), host = _a.host, directory = _a.directory;
                                output_path = path_1.default.join(output, host, "___subsequent_requests", directory);
                                if (!fs_1.default.existsSync(output_path)) {
                                    fs_1.default.mkdirSync(output_path, { recursive: true });
                                }
                                fs_1.default.writeFileSync(path_1.default.join(output_path, "index.js"), text);
                                return [4 /*yield*/, findStaticFiles(text)];
                            case 7:
                                staticFiles = _b.sent();
                                absolutePaths = staticFiles.map(function (file) {
                                    // go through existing JS URLs found
                                    var js_path_dir;
                                    for (var _i = 0, js_urls_1 = js_urls; _i < js_urls_1.length; _i++) {
                                        var js_url = js_urls_1[_i];
                                        if (!js_path_dir &&
                                            new URL(js_url).host === new URL(url).host &&
                                            new URL(js_url).pathname.includes("static/chunks/")) {
                                            js_path_dir = js_url.replace(/\/[^\/]+\.js.*$/, "");
                                        }
                                    }
                                    return js_path_dir.replace("static/chunks", "") + file;
                                });
                                newPaths = absolutePaths.filter(function (path) { return !js_urls.includes(path); });
                                if (newPaths.length > 0) {
                                    staticJSURLs.push.apply(staticJSURLs, newPaths);
                                }
                                _b.label = 8;
                            case 8:
                                queue--;
                                return [3 /*break*/, 10];
                            case 9:
                                e_1 = _b.sent();
                                queue--;
                                console.log(chalk_1.default.red("[!] Error fetching ".concat(reqUrl, ": ").concat(e_1)));
                                return [3 /*break*/, 10];
                            case 10: return [2 /*return*/];
                        }
                    });
                }); });
                return [4 /*yield*/, Promise.all(reqPromises)];
            case 1:
                _a.sent();
                staticJSURLs = __spreadArray([], new Set(staticJSURLs), true);
                console.log(chalk_1.default.green("[\u2713] Found ".concat(staticJSURLs.length, " JS chunks from subsequent requests")));
                return [2 /*return*/, staticJSURLs];
        }
    });
}); };
exports.default = subsequentRequests;
