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
var makeReq_js_1 = require("../../utility/makeReq.js");
var globals_js_1 = require("../globals.js");
var cheerio = require("cheerio");
var nuxt_getFromPageSource = function (url) { return __awaiter(void 0, void 0, void 0, function () {
    var res, pageSource, $, linkTags, _i, linkTags_1, linkTag, asAttr, hrefAttr, urlRoot, scriptTags, _a, scriptTags_1, scriptTag, src, absoluteUrl, pathParts, directory;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                console.log(chalk_1.default.cyan("[i] Analyzing page source"));
                return [4 /*yield*/, (0, makeReq_js_1.default)(url)];
            case 1:
                res = _b.sent();
                return [4 /*yield*/, res.text()];
            case 2:
                pageSource = _b.sent();
                $ = cheerio.load(pageSource);
                linkTags = $("link");
                // go through them, and find the ones which have `as=script` attr
                for (_i = 0, linkTags_1 = linkTags; _i < linkTags_1.length; _i++) {
                    linkTag = linkTags_1[_i];
                    asAttr = $(linkTag).attr("as");
                    if (asAttr === "script") {
                        hrefAttr = $(linkTag).attr("href");
                        if (hrefAttr) {
                            // see if it starts with /_nuxt
                            if (hrefAttr.startsWith("/_nuxt")) {
                                urlRoot = new URL(url).origin;
                                (0, globals_js_1.pushToJsUrls)(urlRoot + hrefAttr);
                            }
                        }
                    }
                }
                scriptTags = $("script");
                for (_a = 0, scriptTags_1 = scriptTags; _a < scriptTags_1.length; _a++) {
                    scriptTag = scriptTags_1[_a];
                    src = $(scriptTag).attr("src");
                    if (src !== undefined &&
                        src.match(/(https:\/\/[a-zA-Z0-9_\_\.]+\/.+\.js\??.*|\/.+\.js\??.*)/)) {
                        if (src.startsWith("http")) {
                            if (!(0, globals_js_1.getJsUrls)().includes(src)) {
                                (0, globals_js_1.pushToJsUrls)(src);
                            }
                        }
                        // if the src starts with /, like `/static/js/a.js` find the absolute URL
                        else if (src.startsWith("/")) {
                            absoluteUrl = new URL(url).origin + src;
                            if (!(0, globals_js_1.getJsUrls)().includes(absoluteUrl)) {
                                (0, globals_js_1.pushToJsUrls)(absoluteUrl);
                            }
                        }
                        else if (src.match(/^[^/]/)) {
                            pathParts = new URL(url).pathname.split("/");
                            pathParts.pop(); // remove the filename from the path
                            directory = new URL(url).origin + pathParts.join("/") + "/";
                            if (!(0, globals_js_1.getJsUrls)().includes(directory + src)) {
                                (0, globals_js_1.pushToJsUrls)(directory + src);
                            }
                        }
                        else {
                            continue;
                        }
                    }
                }
                console.log(chalk_1.default.green("[\u2713] Found ".concat((0, globals_js_1.getJsUrls)().length, " JS files from the page source")));
                return [2 /*return*/, (0, globals_js_1.getJsUrls)()];
        }
    });
}); };
exports.default = nuxt_getFromPageSource;
