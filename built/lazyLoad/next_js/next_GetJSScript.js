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
// lazyLoad/nextGetJSScript.js
var chalk_1 = require("chalk");
var url_1 = require("url");
var cheerio = require("cheerio");
var makeReq_js_1 = require("../../utility/makeReq.js");
var globals_js_1 = require("../globals.js");
/**
 * Asynchronously fetches the given URL and extracts JavaScript file URLs
 * from script tags present in the HTML content.
 *
 * @param {string} url - The URL of the webpage to fetch and parse.
 * @returns {Promise<string[]>} - A promise that resolves to an array of
 * absolute URLs pointing to JavaScript files found in script tags.
 */
var next_getJSScript = function (url) { return __awaiter(void 0, void 0, void 0, function () {
    var res, pageSource, $, scriptTags, _i, scriptTags_1, scriptTag, src, absoluteUrl, pathParts, directory, js_script, matches, uniqueMatches, _a, uniqueMatches_1, match, filename, js_path_dir, _b, _c, js_url;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, makeReq_js_1.default)(url)];
            case 1:
                res = _d.sent();
                return [4 /*yield*/, res.text()];
            case 2:
                pageSource = _d.sent();
                $ = cheerio.load(pageSource);
                scriptTags = $("script");
                // iterate through script tags
                for (_i = 0, scriptTags_1 = scriptTags; _i < scriptTags_1.length; _i++) {
                    scriptTag = scriptTags_1[_i];
                    src = $(scriptTag).attr("src");
                    // see if the src is a JS file
                    if (src !== undefined &&
                        src.match(/(https:\/\/[a-zA-Z0-9_\_\.]+\/.+\.js\??.*|\/.+\.js\??.*)/)) {
                        // if the src starts with /, like `/static/js/a.js` find the absolute URL
                        if (src.startsWith("/")) {
                            absoluteUrl = new url_1.URL(url).origin + src;
                            if (!(0, globals_js_1.getJsUrls)().includes(absoluteUrl)) {
                                (0, globals_js_1.pushToJsUrls)(absoluteUrl);
                            }
                        }
                        else if (src.match(/^[^/]/)) {
                            pathParts = new url_1.URL(url).pathname.split("/");
                            pathParts.pop(); // remove filename from last
                            directory = new url_1.URL(url).origin + pathParts.join("/") + "/";
                            if (!(0, globals_js_1.getJsUrls)().includes(directory + src)) {
                                (0, globals_js_1.pushToJsUrls)(directory + src);
                            }
                        }
                        else {
                            if (!(0, globals_js_1.getJsUrls)().includes(src)) {
                                (0, globals_js_1.pushToJsUrls)(src);
                            }
                        }
                    }
                    else {
                        js_script = $(scriptTag).html();
                        matches = js_script.match(/static\/chunks\/[a-zA-Z0-9_\-]+\.js/g);
                        if (matches) {
                            uniqueMatches = __spreadArray([], new Set(matches), true);
                            for (_a = 0, uniqueMatches_1 = uniqueMatches; _a < uniqueMatches_1.length; _a++) {
                                match = uniqueMatches_1[_a];
                                filename = match.replace("static/chunks/", "");
                                js_path_dir = void 0;
                                for (_b = 0, _c = (0, globals_js_1.getJsUrls)(); _b < _c.length; _b++) {
                                    js_url = _c[_b];
                                    if (!js_path_dir &&
                                        new url_1.URL(js_url).host === new url_1.URL(url).host &&
                                        new url_1.URL(js_url).pathname.includes("static/chunks/")) {
                                        js_path_dir = js_url.replace(/\/[^\/]+\.js.*$/, "");
                                    }
                                }
                                if (js_path_dir) {
                                    // Ensure js_path_dir was found
                                    (0, globals_js_1.pushToJsUrls)(js_path_dir + "/" + filename);
                                }
                            }
                        }
                    }
                }
                console.log(chalk_1.default.green("[\u2713] Found ".concat((0, globals_js_1.getJsUrls)().length, " JS files from the script tags")));
                return [2 /*return*/, (0, globals_js_1.getJsUrls)()];
        }
    });
}); };
exports.default = next_getJSScript;
