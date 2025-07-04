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
var makeReq_js_1 = require("../../utility/makeReq.js");
var globals_js_1 = require("../globals.js");
var resolvePath_js_1 = require("../../utility/resolvePath.js");
// for parsing
var parser_1 = require("@babel/parser");
var traverse_1 = require("@babel/traverse");
var traverse = traverse_1.default.default;
var analyzedFiles = [];
var filesFound = [];
var parseJSFileContent = function (content) { return __awaiter(void 0, void 0, void 0, function () {
    var ast, foundJsFiles_1;
    return __generator(this, function (_a) {
        try {
            ast = parser_1.default.parse(content, {
                sourceType: "module",
                plugins: ["jsx", "typescript"],
            });
            foundJsFiles_1 = {};
            traverse(ast, {
                StringLiteral: function (path) {
                    var value = path.node.value;
                    if (value.startsWith("./") && value.endsWith(".js")) {
                        foundJsFiles_1[value] = value;
                    }
                    else if (value.startsWith("../") && value.endsWith(".js")) {
                        foundJsFiles_1[value] = value;
                    }
                    else if (value.endsWith(".js")) {
                        foundJsFiles_1[value] = value;
                    }
                },
            });
            return [2 /*return*/, foundJsFiles_1];
        }
        catch (error) {
            return [2 /*return*/, {}];
        }
        return [2 /*return*/];
    });
}); };
var nuxt_stringAnalysisJSFiles = function (url) { return __awaiter(void 0, void 0, void 0, function () {
    var js_urls, everythingAnalyzed, _i, js_urls_1, url_1, _a, js_urls_2, js_url, response, respText, foundJsFiles, _b, _c, _d, key, value, resolvedPath;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                console.log(chalk_1.default.cyan("[i] Analyzing strings in the files found"));
                _e.label = 1;
            case 1:
                if (!true) return [3 /*break*/, 12];
                js_urls = (0, globals_js_1.getJsUrls)();
                if (js_urls.length === 0) {
                    console.log(chalk_1.default.red("[!] No JS files found for string analysis"));
                    return [3 /*break*/, 12];
                }
                everythingAnalyzed = true;
                for (_i = 0, js_urls_1 = js_urls; _i < js_urls_1.length; _i++) {
                    url_1 = js_urls_1[_i];
                    //   if the url is not in analyzedFiles, set everythingAnalyzed to false
                    if (!analyzedFiles.includes(url_1)) {
                        everythingAnalyzed = false;
                    }
                }
                // break if everything is analyzed
                if (everythingAnalyzed) {
                    return [3 /*break*/, 12];
                }
                _a = 0, js_urls_2 = js_urls;
                _e.label = 2;
            case 2:
                if (!(_a < js_urls_2.length)) return [3 /*break*/, 11];
                js_url = js_urls_2[_a];
                if (analyzedFiles.includes(js_url)) {
                    return [3 /*break*/, 10];
                }
                return [4 /*yield*/, (0, makeReq_js_1.default)(js_url)];
            case 3:
                response = _e.sent();
                return [4 /*yield*/, response.text()];
            case 4:
                respText = _e.sent();
                return [4 /*yield*/, parseJSFileContent(respText)];
            case 5:
                foundJsFiles = _e.sent();
                _b = 0, _c = Object.entries(foundJsFiles);
                _e.label = 6;
            case 6:
                if (!(_b < _c.length)) return [3 /*break*/, 9];
                _d = _c[_b], key = _d[0], value = _d[1];
                return [4 /*yield*/, (0, resolvePath_js_1.default)(js_url, value)];
            case 7:
                resolvedPath = _e.sent();
                if (analyzedFiles.includes(resolvedPath)) {
                    return [3 /*break*/, 8];
                }
                (0, globals_js_1.pushToJsUrls)(resolvedPath);
                filesFound.push(resolvedPath);
                _e.label = 8;
            case 8:
                _b++;
                return [3 /*break*/, 6];
            case 9:
                analyzedFiles.push(js_url);
                _e.label = 10;
            case 10:
                _a++;
                return [3 /*break*/, 2];
            case 11: return [3 /*break*/, 1];
            case 12:
                // dedupe the files
                filesFound = __spreadArray([], new Set(filesFound), true);
                console.log(chalk_1.default.green("[\u2713] Found ".concat(filesFound.length, " JS files from string analysis")));
                return [2 /*return*/, filesFound];
        }
    });
}); };
exports.default = nuxt_stringAnalysisJSFiles;
