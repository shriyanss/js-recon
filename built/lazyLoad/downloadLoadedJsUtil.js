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
/**
 * Downloads all the lazy loaded JS files from a given URL.
 *
 * It opens a headless browser instance, navigates to the given URL, and
 * intercepts all the requests. It checks if the request is a JS file
 * and if it is a GET request. If both conditions are satisfied, the URL
 * is added to the array of URLs. Finally, it closes the browser instance
 * and returns the array of URLs.
 *
 * @param {string} url - The URL of the webpage to fetch and parse.
 * @returns {Promise<string[]|undefined>} - A promise that resolves to an array of
 * absolute URLs pointing to JavaScript files found in the page, or undefined for invalid URL.
 */
var downloadLoadedJs = function (url) { return __awaiter(void 0, void 0, void 0, function () {
    var browser, page, js_urls_local;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!url.match(/https?:\/\/[a-zA-Z0-9\._\-]+/)) {
                    console.log(chalk_1.default.red("[!] Invalid URL"));
                    return [2 /*return*/]; // Return undefined as per JSDoc
                }
                return [4 /*yield*/, puppeteer_1.default.launch({
                        headless: true,
                    })];
            case 1:
                browser = _a.sent();
                return [4 /*yield*/, browser.newPage()];
            case 2:
                page = _a.sent();
                return [4 /*yield*/, page.setRequestInterception(true)];
            case 3:
                _a.sent();
                js_urls_local = [];
                page.on("request", function (request) { return __awaiter(void 0, void 0, void 0, function () {
                    var req_url;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                req_url = request.url();
                                // see if the request is a JS file, and is a get request
                                if (request.method() === "GET" &&
                                    req_url.match(/https?:\/\/[a-z\._\-]+\/.+\.js\??.*/)) {
                                    js_urls_local.push(req_url);
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
                _a.sent();
                return [4 /*yield*/, browser.close()];
            case 5:
                _a.sent();
                return [2 /*return*/, js_urls_local];
        }
    });
}); };
exports.default = downloadLoadedJs;
