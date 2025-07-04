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
var index_js_1 = require("../techDetect/index.js");
var globalConfig_js_1 = require("../globalConfig.js");
var traverse_1 = require("@babel/traverse");
var traverse = traverse_1.default.default;
var url_1 = require("url");
// Next.js
var next_SubsequentRequests_js_1 = require("./next_js/next_SubsequentRequests.js");
var next_GetJSScript_js_1 = require("./next_js/next_GetJSScript.js");
var next_GetLazyResources_js_1 = require("./next_js/next_GetLazyResources.js");
// Nuxt.js
var nuxt_getFromPageSource_js_1 = require("./nuxt_js/nuxt_getFromPageSource.js");
var nuxt_stringAnalysisJSFiles_js_1 = require("./nuxt_js/nuxt_stringAnalysisJSFiles.js");
var nuxt_astParse_js_1 = require("./nuxt_js/nuxt_astParse.js");
// Svelte
var svelte_getFromPageSource_js_1 = require("./svelte/svelte_getFromPageSource.js");
var svelte_stringAnalysisJSFiles_js_1 = require("./svelte/svelte_stringAnalysisJSFiles.js");
// generic
var downloadFilesUtil_js_1 = require("./downloadFilesUtil.js");
var downloadLoadedJsUtil_js_1 = require("./downloadLoadedJsUtil.js");
// import global vars
var lazyLoadGlobals = require("./globals.js");
var globals = require("../utility/globals.js");
/**
 * Downloads all lazy-loaded JavaScript files from the specified URL or file containing URLs.
 *
 * The function detects the JavaScript framework used by the webpage (e.g., Next.js, Nuxt.js)
 * and utilizes specific techniques to find and download lazy-loaded JS files.
 * It supports subsequent requests for additional JS files if specified.
 *
 * @param {string} url - The URL or path to a file containing a list of URLs to process.
 * @param {string} output - The directory where downloaded files will be saved.
 * @param {boolean} strictScope - Whether to restrict downloads to the input URL domain.
 * @param {string[]} inputScope - Specific domains to download JS files from.
 * @param {number} threads - The number of threads to use for downloading files.
 * @param {boolean} subsequentRequestsFlag - Whether to include JS files from subsequent requests.
 * @param {string} urlsFile - The JSON file containing additional URLs for subsequent requests.
 * @returns {Promise<void>}
 */
var lazyLoad = function (url, output, strictScope, inputScope, threads, subsequentRequestsFlag, urlsFile) { return __awaiter(void 0, void 0, void 0, function () {
    var urls, _i, urls_1, url_2, tech, jsFilesFromScriptTag, lazyResourcesFromWebpack, lazyResourcesFromSubsequentRequests, jsFilesToDownload, jsFilesToDownload, jsFilesFromPageSource, jsFilesFromStringAnalysis, jsFilesFromAST, _a, jsFilesToDownload_1, jsFile, _b, _c, _d, jsFilesToDownload, jsFilesFromPageSource, jsFilesFromStringAnalysis, js_urls;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                console.log(chalk_1.default.cyan("[i] Loading 'Lazy Load' module"));
                // if cache enabled, check if the cache file exists or not. If no, then create a new one
                if (!globals.getDisableCache()) {
                    if (!fs_1.default.existsSync(globals.getRespCacheFile())) {
                        fs_1.default.writeFileSync(globals.getRespCacheFile(), "{}");
                    }
                }
                // check if the url is file or a URL
                if (fs_1.default.existsSync(url)) {
                    urls = fs_1.default.readFileSync(url, "utf8").split("\n");
                    // remove the empty lines
                    urls = urls.filter(function (url) { return url.trim() !== ""; });
                }
                else if (url.match(/https?:\/\/[a-zA-Z0-9\-_\.:]+/)) {
                    urls = [url];
                }
                else {
                    console.log(chalk_1.default.red("[!] Invalid URL or file path"));
                    return [2 /*return*/];
                }
                _i = 0, urls_1 = urls;
                _e.label = 1;
            case 1:
                if (!(_i < urls_1.length)) return [3 /*break*/, 26];
                url_2 = urls_1[_i];
                console.log(chalk_1.default.cyan("[i] Processing ".concat(url_2)));
                if (strictScope) {
                    lazyLoadGlobals.pushToScope(new url_1.URL(url_2).host);
                }
                else {
                    lazyLoadGlobals.setScope(inputScope);
                }
                lazyLoadGlobals.setMaxReqQueue(threads);
                lazyLoadGlobals.clearJsUrls(); // Initialize js_urls for each URL processing in the loop
                return [4 /*yield*/, (0, index_js_1.default)(url_2)];
            case 2:
                tech = _e.sent();
                globals.setTech(tech ? tech.name : undefined);
                if (!tech) return [3 /*break*/, 22];
                if (!(tech.name === "next")) return [3 /*break*/, 8];
                console.log(chalk_1.default.green("[✓] Next.js detected"));
                console.log(chalk_1.default.yellow("Evidence: ".concat(tech.evidence)));
                return [4 /*yield*/, (0, next_GetJSScript_js_1.default)(url_2)];
            case 3:
                jsFilesFromScriptTag = _e.sent();
                return [4 /*yield*/, (0, next_GetLazyResources_js_1.default)(url_2)];
            case 4:
                lazyResourcesFromWebpack = _e.sent();
                lazyResourcesFromSubsequentRequests = void 0;
                if (!subsequentRequestsFlag) return [3 /*break*/, 6];
                return [4 /*yield*/, (0, next_SubsequentRequests_js_1.default)(url_2, urlsFile, threads, output, lazyLoadGlobals.getJsUrls() // Pass the global js_urls
                    )];
            case 5:
                // get JS files from subsequent requests
                lazyResourcesFromSubsequentRequests =
                    _e.sent();
                _e.label = 6;
            case 6:
                jsFilesToDownload = __spreadArray(__spreadArray(__spreadArray([], (jsFilesFromScriptTag || []), true), (lazyResourcesFromWebpack || []), true), (lazyResourcesFromSubsequentRequests || []), true);
                // Ensure js_urls from globals are included if next_getJSScript or next_getLazyResources populated it.
                // This is because those functions now push to the global js_urls via setters.
                // The return values of next_getJSScript and next_getLazyResources might be the same array instance
                // or a new one depending on their implementation, so explicitly get the global one here.
                jsFilesToDownload.push.apply(jsFilesToDownload, lazyLoadGlobals.getJsUrls());
                // dedupe the files
                jsFilesToDownload = __spreadArray([], new Set(jsFilesToDownload), true);
                return [4 /*yield*/, (0, downloadFilesUtil_js_1.default)(jsFilesToDownload, output)];
            case 7:
                _e.sent();
                return [3 /*break*/, 21];
            case 8:
                if (!(tech.name === "vue")) return [3 /*break*/, 9];
                console.log(chalk_1.default.green("[✓] Vue.js detected"));
                console.log(chalk_1.default.yellow("Evidence: ".concat(tech.evidence)));
                return [3 /*break*/, 21];
            case 9:
                if (!(tech.name === "nuxt")) return [3 /*break*/, 17];
                console.log(chalk_1.default.green("[✓] Nuxt.js detected"));
                console.log(chalk_1.default.yellow("Evidence: ".concat(tech.evidence)));
                jsFilesToDownload = [];
                return [4 /*yield*/, (0, nuxt_getFromPageSource_js_1.default)(url_2)];
            case 10:
                jsFilesFromPageSource = _e.sent();
                return [4 /*yield*/, (0, nuxt_stringAnalysisJSFiles_js_1.default)(url_2)];
            case 11:
                jsFilesFromStringAnalysis = _e.sent();
                jsFilesToDownload.push.apply(jsFilesToDownload, jsFilesFromPageSource);
                jsFilesToDownload.push.apply(jsFilesToDownload, jsFilesFromStringAnalysis);
                // dedupe the files
                jsFilesToDownload = __spreadArray([], new Set(jsFilesToDownload), true);
                jsFilesFromAST = [];
                console.log(chalk_1.default.cyan("[i] Analyzing functions in the files found"));
                _a = 0, jsFilesToDownload_1 = jsFilesToDownload;
                _e.label = 12;
            case 12:
                if (!(_a < jsFilesToDownload_1.length)) return [3 /*break*/, 15];
                jsFile = jsFilesToDownload_1[_a];
                _c = (_b = jsFilesFromAST.push).apply;
                _d = [jsFilesFromAST];
                return [4 /*yield*/, (0, nuxt_astParse_js_1.default)(jsFile)];
            case 13:
                _c.apply(_b, _d.concat([(_e.sent())]));
                _e.label = 14;
            case 14:
                _a++;
                return [3 /*break*/, 12];
            case 15:
                jsFilesToDownload.push.apply(jsFilesToDownload, jsFilesFromAST);
                jsFilesToDownload.push.apply(jsFilesToDownload, lazyLoadGlobals.getJsUrls());
                // dedupe the files
                jsFilesToDownload = __spreadArray([], new Set(jsFilesToDownload), true);
                return [4 /*yield*/, (0, downloadFilesUtil_js_1.default)(jsFilesToDownload, output)];
            case 16:
                _e.sent();
                return [3 /*break*/, 21];
            case 17:
                if (!(tech.name === "svelte")) return [3 /*break*/, 21];
                console.log(chalk_1.default.green("[✓] Svelte detected"));
                console.log(chalk_1.default.yellow("Evidence: ".concat(tech.evidence)));
                jsFilesToDownload = [];
                return [4 /*yield*/, (0, svelte_getFromPageSource_js_1.default)(url_2)];
            case 18:
                jsFilesFromPageSource = _e.sent();
                jsFilesToDownload.push.apply(jsFilesToDownload, jsFilesFromPageSource);
                return [4 /*yield*/, (0, svelte_stringAnalysisJSFiles_js_1.default)(url_2)];
            case 19:
                jsFilesFromStringAnalysis = _e.sent();
                jsFilesToDownload.push.apply(jsFilesToDownload, jsFilesFromStringAnalysis);
                // dedupe the files
                jsFilesToDownload = __spreadArray([], new Set(jsFilesToDownload), true);
                return [4 /*yield*/, (0, downloadFilesUtil_js_1.default)(jsFilesToDownload, output)];
            case 20:
                _e.sent();
                _e.label = 21;
            case 21: return [3 /*break*/, 25];
            case 22:
                console.log(chalk_1.default.red("[!] Framework not detected :("));
                console.log(chalk_1.default.magenta(globalConfig_js_1.default.notFoundMessage));
                console.log(chalk_1.default.yellow("[i] Trying to download loaded JS files"));
                return [4 /*yield*/, (0, downloadLoadedJsUtil_js_1.default)(url_2)];
            case 23:
                js_urls = _e.sent();
                if (!(js_urls && js_urls.length > 0)) return [3 /*break*/, 25];
                console.log(chalk_1.default.green("[\u2713] Found ".concat(js_urls.length, " JS chunks")));
                return [4 /*yield*/, (0, downloadFilesUtil_js_1.default)(js_urls, output)];
            case 24:
                _e.sent();
                _e.label = 25;
            case 25:
                _i++;
                return [3 /*break*/, 1];
            case 26: return [2 /*return*/];
        }
    });
}); };
exports.default = lazyLoad;
