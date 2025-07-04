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
var globals = require("./globals.js");
var genReq_js_1 = require("../api_gateway/genReq.js");
var fs_1 = require("fs");
// random user agents
var UAs = [
    "Chrome/Windows: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Chrome/Windows: Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Chrome/Windows: Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Chrome/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Chrome/Linux: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Chrome/iPhone: Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/87.0.4280.77 Mobile/15E148 Safari/604.1",
    "Chrome/iPhone (request desktop): Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/87 Version/11.1.1 Safari/605.1.15",
    "Chrome/iPad: Mozilla/5.0 (iPad; CPU OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/87.0.4280.77 Mobile/15E148 Safari/604.1",
    "Chrome/iPod: Mozilla/5.0 (iPod; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/87.0.4280.77 Mobile/15E148 Safari/604.1",
    "Chrome/Android: Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Mobile Safari/537.36",
    "Chrome/Android: Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Mobile Safari/537.36",
    "Chrome/Android: Mozilla/5.0 (Linux; Android 10; LM-Q720) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Mobile Safari/537.36",
    "Firefox/Windows: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:84.0) Gecko/20100101 Firefox/84.0",
    "Firefox/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11.1; rv:84.0) Gecko/20100101 Firefox/84.0",
    "Firefox/Linux: Mozilla/5.0 (X11; Linux i686; rv:84.0) Gecko/20100101 Firefox/84.0",
    "Firefox/iPhone: Mozilla/5.0 (iPhone; CPU iPhone OS 11_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/30.0 Mobile/15E148 Safari/605.1.15",
    "Firefox/iPad: Mozilla/5.0 (iPad; CPU OS 11_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/30.0 Mobile/15E148 Safari/605.1.15",
    "Firefox/Android: Mozilla/5.0 (Android 11; Mobile; rv:68.0) Gecko/68.0 Firefox/84.0",
    "Safari/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.2 Safari/605.1.15",
    "Safari/iPhone: Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
    "Safari/iPhone (request desktop): Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15",
    "Safari/iPad: Mozilla/5.0 (iPad; CPU OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
    "IE11/Windows: Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko",
    "Edge/Windows: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Edg/87.0.664.66",
    "Edge/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Edg/87.0.664.66",
    "Edge/Android: Mozilla/5.0 (Linux; Android 10; HD1913) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Mobile Safari/537.36 EdgA/45.12.4.5121",
    "Edge/iOS: Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 EdgiOS/45.11.11 Mobile/15E148 Safari/605.1.15",
    "Opera/Windows: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 OPR/73.0.3856.329",
    "Opera/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 OPR/73.0.3856.329",
    "Opera/Linux: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 OPR/73.0.3856.329",
    "Opera/Android: Mozilla/5.0 (Linux; Android 10; VOG-L29) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Mobile Safari/537.36 OPR/61.1.3076.56625",
    "Vivaldi/Windows: Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Vivaldi/3.5",
    "Vivaldi/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Vivaldi/3.5",
    "Vivaldi/Linux: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Vivaldi/3.5",
    "Yandex/Windows: Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 YaBrowser/20.12.0 Yowser/2.5 Safari/537.36",
    "Yandex/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 YaBrowser/20.12.0 Yowser/2.5 Safari/537.36",
    "Yandex/iOS: Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 YaBrowser/20.11.2.199 Mobile/15E148 Safari/604.1",
    "Yandex/Android: Mozilla/5.0 (Linux; arm_64; Android 11; SM-G965F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 YaBrowser/20.12.29.180 Mobile Safari/537.36",
    "Chrome/ChromeOS: Mozilla/5.0 (X11; CrOS x86_64 13505.63.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Safari/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.2 Safari/605.1.15",
    "Firefox/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11.1; rv:84.0) Gecko/20100101 Firefox/84.0",
    "Chrome/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Vivaldi/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Vivaldi/3.5",
    "Edge/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Edg/87.0.664.66",
    "Safari/iOS: Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
    "Chrome/iOS: Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/87.0.4280.77 Mobile/15E148 Safari/604.1",
    "Firefox/iOS: Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/30.0 Mobile/15E148 Safari/605.1.15",
    "Edge/Windows: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Edg/87.0.664.66",
    "Internet-Explorer/Windows: Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko",
    "Chrome/Windows: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Firefox/Windows: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:84.0) Gecko/20100101 Firefox/84.0",
    "Vivaldi/Windows: Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Vivaldi/3.5",
    "Chrome/Android: Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Mobile Safari/537.36",
    "Firefox/Android: Mozilla/5.0 (Android 11; Mobile; rv:68.0) Gecko/68.0 Firefox/84.0",
];
var readCache = function (url, headers) { return __awaiter(void 0, void 0, void 0, function () {
    var cache, headersMatch, rscEnabled;
    return __generator(this, function (_a) {
        cache = JSON.parse(fs_1.default.readFileSync(globals.getRespCacheFile(), "utf-8"));
        if (cache[url]) {
            headersMatch = true;
            rscEnabled = headers["RSC"] ? true : false;
            if (rscEnabled) {
                if (cache[url].rsc) {
                    return [2 /*return*/, new Response(atob(cache[url].rsc.body_b64), {
                            status: cache[url].rsc.status,
                            headers: cache[url].rsc.resp_headers,
                        })];
                }
            }
            if (!rscEnabled && cache[url] && cache[url].normal) {
                return [2 /*return*/, new Response(atob(cache[url].normal.body_b64), {
                        status: cache[url].normal.status,
                        headers: cache[url].normal.resp_headers,
                    })];
            }
        }
        // console.log("cache not found for ", url);
        return [2 /*return*/, null];
    });
}); };
var writeCache = function (url, headers, response) { return __awaiter(void 0, void 0, void 0, function () {
    var clonedResponse, cache, body, _a, _b, status, resp_headers;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                clonedResponse = response.clone();
                return [4 /*yield*/, readCache(url, headers)];
            case 1:
                // if cache exists, return
                if ((_c.sent()) !== null) {
                    // console.log("cache already exists for ", url);
                    return [2 /*return*/];
                }
                cache = JSON.parse(fs_1.default.readFileSync(globals.getRespCacheFile(), "utf-8"));
                if (!cache[url]) {
                    cache[url] = {};
                }
                _a = btoa;
                _b = encodeURIComponent;
                return [4 /*yield*/, clonedResponse.text()];
            case 2:
                body = _a.apply(void 0, [_b.apply(void 0, [_c.sent()]).replace(/%([0-9A-F]{2})/g, function (match, p1) { return String.fromCharCode("0x".concat(p1)); })]);
                status = clonedResponse.status;
                resp_headers = clonedResponse.headers;
                if (headers["RSC"]) {
                    cache[url].rsc = {
                        req_headers: headers,
                        status: status,
                        body_b64: body,
                        resp_headers: resp_headers,
                    };
                    // console.log("rsc", url);
                }
                else {
                    cache[url].normal = {
                        req_headers: headers,
                        status: status,
                        body_b64: body,
                        resp_headers: resp_headers,
                    };
                    // console.log("normal", url);
                }
                fs_1.default.writeFileSync(globals.getRespCacheFile(), JSON.stringify(cache));
                return [2 /*return*/];
        }
    });
}); };
var makeRequest = function (url, args) { return __awaiter(void 0, void 0, void 0, function () {
    var cachedResponse, get_headers, body, response, res, counter, err_1, preservedRes, resp_text, browser, page, content, browser, page, content, resToCache;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!!globals.getDisableCache()) return [3 /*break*/, 2];
                return [4 /*yield*/, readCache(url, (args === null || args === void 0 ? void 0 : args.headers) || {})];
            case 1:
                cachedResponse = _a.sent();
                if (cachedResponse !== null) {
                    return [2 /*return*/, cachedResponse];
                }
                _a.label = 2;
            case 2:
                if (!globals.useApiGateway) return [3 /*break*/, 6];
                get_headers = void 0;
                if (args && args.headers) {
                    get_headers = args.headers;
                }
                else {
                    get_headers = {
                        "User-Agent": UAs[Math.floor(Math.random() * UAs.length)],
                        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                        "Accept-Language": "en-US,en;q=0.9",
                        "Sec-Fetch-Site": "same-origin",
                        "Sec-Fetch-Mode": "cors",
                        "Sec-Fetch-Dest": "empty",
                        Referer: url,
                        Origin: url,
                    };
                }
                return [4 /*yield*/, (0, genReq_js_1.get)(url, get_headers)];
            case 3:
                body = _a.sent();
                response = new Response(body);
                if (!!globals.getDisableCache()) return [3 /*break*/, 5];
                return [4 /*yield*/, writeCache(url, get_headers, response)];
            case 4:
                _a.sent();
                _a.label = 5;
            case 5: return [2 /*return*/, response];
            case 6:
                if (args === undefined) {
                    args = {
                        headers: {
                            "User-Agent": UAs[Math.floor(Math.random() * UAs.length)],
                            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                            "Accept-Language": "en-US,en;q=0.9",
                            "Sec-Fetch-Site": "same-origin",
                            "Sec-Fetch-Mode": "cors",
                            "Sec-Fetch-Dest": "empty",
                            Referer: url,
                            Origin: url,
                        },
                    };
                }
                res = void 0;
                counter = 0;
                _a.label = 7;
            case 7:
                if (!true) return [3 /*break*/, 13];
                _a.label = 8;
            case 8:
                _a.trys.push([8, 10, , 12]);
                return [4 /*yield*/, fetch(url, args)];
            case 9:
                res = _a.sent();
                if (res) {
                    return [3 /*break*/, 13];
                }
                return [3 /*break*/, 12];
            case 10:
                err_1 = _a.sent();
                counter++;
                if (counter > 10) {
                    console.log(chalk_1.default.red("[!] Failed to fetch ".concat(url)));
                    return [2 /*return*/, null];
                }
                // sleep 0.5 s before retrying
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
            case 11:
                // sleep 0.5 s before retrying
                _a.sent();
                return [3 /*break*/, 7];
            case 12: return [3 /*break*/, 7];
            case 13:
                preservedRes = res.clone();
                return [4 /*yield*/, res.text()];
            case 14:
                resp_text = _a.sent();
                if (!resp_text.includes("/?bm-verify=")) return [3 /*break*/, 23];
                console.log(chalk_1.default.yellow("[!] CF Firewall detected. Trying to bypass with headless browser"));
                return [4 /*yield*/, puppeteer_1.default.launch({
                        headless: true,
                        args: [
                            "--disable-gpu",
                            "--disable-dev-shm-usage",
                            "--disable-setuid-sandbox",
                            "--no-sandbox",
                        ],
                    })];
            case 15:
                browser = _a.sent();
                return [4 /*yield*/, browser.newPage()];
            case 16:
                page = _a.sent();
                return [4 /*yield*/, page.goto(url)];
            case 17:
                _a.sent();
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 5000); })];
            case 18:
                _a.sent();
                return [4 /*yield*/, page.content()];
            case 19:
                content = _a.sent();
                return [4 /*yield*/, browser.close()];
            case 20:
                _a.sent();
                if (!!globals.getDisableCache()) return [3 /*break*/, 22];
                return [4 /*yield*/, writeCache(url, get_headers, new Response(content))];
            case 21:
                _a.sent();
                _a.label = 22;
            case 22: return [2 /*return*/, new Response(content)];
            case 23:
                if (!resp_text.includes("<title>Just a moment...</title>")) return [3 /*break*/, 32];
                console.log(chalk_1.default.yellow("[!] CF Firewall detected. Trying to bypass with headless browser"));
                return [4 /*yield*/, puppeteer_1.default.launch({
                        headless: true,
                        args: [
                            "--disable-gpu",
                            "--disable-dev-shm-usage",
                            "--disable-setuid-sandbox",
                            "--no-sandbox",
                        ],
                    })];
            case 24:
                browser = _a.sent();
                return [4 /*yield*/, browser.newPage()];
            case 25:
                page = _a.sent();
                return [4 /*yield*/, page.goto(url)];
            case 26:
                _a.sent();
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 5000); })];
            case 27:
                _a.sent();
                return [4 /*yield*/, page.content()];
            case 28:
                content = _a.sent();
                return [4 /*yield*/, browser.close()];
            case 29:
                _a.sent();
                if (!!globals.getDisableCache()) return [3 /*break*/, 31];
                return [4 /*yield*/, writeCache(url, {}, new Response(content))];
            case 30:
                _a.sent();
                _a.label = 31;
            case 31: return [2 /*return*/, new Response(content)];
            case 32:
                if (!!globals.getDisableCache()) return [3 /*break*/, 34];
                resToCache = preservedRes.clone();
                return [4 /*yield*/, writeCache(url, (args === null || args === void 0 ? void 0 : args.headers) || {}, resToCache)];
            case 33:
                _a.sent();
                _a.label = 34;
            case 34: return [2 /*return*/, preservedRes];
        }
    });
}); };
exports.default = makeRequest;
