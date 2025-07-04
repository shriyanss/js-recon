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
var cheerio = require("cheerio");
var makeReq_js_1 = require("../utility/makeReq.js");
var puppeteer_1 = require("puppeteer");
/**
 * Detects if a webpage uses Next.js by checking if any HTML tag has a src,
 * srcset, or imageSrcSet attribute that starts with "/_next/".
 * @param {CheerioStatic} $ - The Cheerio object containing the parsed HTML.
 * @returns {Promise<{detected: boolean, evidence: string}>}
 *   A promise that resolves to an object with two properties:
 *   - detected: A boolean indicating whether Next.js was detected.
 *   - evidence: A string with the evidence of the detection, or an empty string
 *     if Next.js was not detected.
 */
var checkNextJS = function ($) { return __awaiter(void 0, void 0, void 0, function () {
    var detected, evidence;
    return __generator(this, function (_a) {
        detected = false;
        evidence = "";
        // iterate through each HTML tag, and file tag value that starts with `/_next/`
        $("*").each(function (_, el) {
            var tag = $(el).get(0).tagName;
            // check the value of three attributes
            var src = $(el).attr("src");
            var srcSet = $(el).attr("srcset");
            var imageSrcSet = $(el).attr("imageSrcSet");
            if (src || srcSet || imageSrcSet) {
                if (src && src.startsWith("/_next/")) {
                    detected = true;
                    evidence = "".concat(tag, " :: ").concat(src);
                }
                else if (srcSet && srcSet.startsWith("/_next/")) {
                    detected = true;
                    evidence = "".concat(tag, " :: ").concat(srcSet);
                }
                else if (imageSrcSet && imageSrcSet.startsWith("/_next/")) {
                    detected = true;
                    evidence = "".concat(tag, " :: ").concat(imageSrcSet);
                }
            }
        });
        return [2 /*return*/, { detected: detected, evidence: evidence }];
    });
}); };
/**
 * Detects if a webpage uses Vue.js by checking if any HTML tag has a data-v-* attribute.
 * @param {CheerioStatic} $ - The Cheerio object containing the parsed HTML.
 * @returns {Promise<{detected: boolean, evidence: string}>}
 *   A promise that resolves to an object with two properties:
 *   - detected: A boolean indicating whether Vue.js was detected.
 *   - evidence: A string with the evidence of the detection, or an empty string
 *     if Vue.js was not detected.
 */
var checkVueJS = function ($) { return __awaiter(void 0, void 0, void 0, function () {
    var detected, evidence;
    return __generator(this, function (_a) {
        detected = false;
        evidence = "";
        $("*").each(function (_, el) {
            var tag = $(el).get(0).tagName;
            var attribs = el.attribs;
            if (attribs) {
                for (var _i = 0, _a = Object.entries(attribs); _i < _a.length; _i++) {
                    var _b = _a[_i], attrName = _b[0], attrValue = _b[1];
                    if (attrName.startsWith("data-v-")) {
                        detected = true;
                        evidence = "".concat(tag, " :: ").concat(attrName);
                    }
                }
            }
        });
        return [2 /*return*/, { detected: detected, evidence: evidence }];
    });
}); };
var checkNuxtJS = function ($) { return __awaiter(void 0, void 0, void 0, function () {
    var detected, evidence;
    return __generator(this, function (_a) {
        detected = false;
        evidence = "";
        // go through the page source, and check for "/_nuxt" in the src or href attribute
        $("*").each(function (_, el) {
            var tag = $(el).get(0).tagName;
            var attribs = el.attribs;
            if (attribs) {
                for (var _i = 0, _a = Object.entries(attribs); _i < _a.length; _i++) {
                    var _b = _a[_i], attrName = _b[0], attrValue = _b[1];
                    if (attrName === "src" || attrName === "href") {
                        if (attrValue.includes("/_nuxt")) {
                            detected = true;
                            evidence = "".concat(attrName, " :: ").concat(attrValue);
                        }
                    }
                }
            }
        });
        return [2 /*return*/, { detected: detected, evidence: evidence }];
    });
}); };
var checkSvelte = function ($) { return __awaiter(void 0, void 0, void 0, function () {
    var detected, evidence;
    return __generator(this, function (_a) {
        detected = false;
        evidence = "";
        // go through the page source, and check for all the class names of all HTML tags
        $("*").each(function (_, el) {
            var tag = $(el).get(0).tagName;
            var attribs = el.attribs;
            if (attribs) {
                for (var _i = 0, _a = Object.entries(attribs); _i < _a.length; _i++) {
                    var _b = _a[_i], attrName = _b[0], attrValue = _b[1];
                    if (attrName === "class") {
                        if (attrValue.includes("svelte-")) {
                            detected = true;
                            evidence = "".concat(attrName, " :: ").concat(attrValue);
                        }
                    }
                }
            }
        });
        // now, search for the svelte- id of all elements
        $("*").each(function (_, el) {
            var tag = $(el).get(0).tagName;
            var attribs = el.attribs;
            if (attribs) {
                for (var _i = 0, _a = Object.entries(attribs); _i < _a.length; _i++) {
                    var _b = _a[_i], attrName = _b[0], attrValue = _b[1];
                    if (attrName === "id") {
                        if (attrValue.includes("svelte-")) {
                            detected = true;
                            evidence = "".concat(attrName, " :: ").concat(attrValue);
                        }
                    }
                }
            }
        });
        // now, check for the data-sveltekit-reload attribute
        $("*").each(function (_, el) {
            var tag = $(el).get(0).tagName;
            var attribs = el.attribs;
            if (attribs) {
                for (var _i = 0, _a = Object.entries(attribs); _i < _a.length; _i++) {
                    var _b = _a[_i], attrName = _b[0], attrValue = _b[1];
                    if (attrName === "data-sveltekit-reload") {
                        detected = true;
                        evidence = "".concat(attrName, " :: ").concat(attrValue);
                    }
                }
            }
        });
        return [2 /*return*/, { detected: detected, evidence: evidence }];
    });
}); };
/**
 * Detects the front-end framework used by a webpage.
 * @param {string} url - The URL of the webpage to be detected.
 * @returns {Promise<{name: string, evidence: string}> | null}
 *   A promise that resolves to an object with two properties:
 *   - name: A string indicating the detected framework, or null if no framework was detected.
 *   - evidence: A string with the evidence of the detection, or an empty string if no framework was detected.
 */
var frameworkDetect = function (url) { return __awaiter(void 0, void 0, void 0, function () {
    var res, browser, page, err_1, pageSource, $, result_checkNextJS, result_checkVueJS, result_checkSvelte, resBody, $res, result_checkNextJS_res, result_checkVueJS_res, result_checkSvelte_res, evidence, result_checkNuxtJS, result_checkNuxtJS_res, evidence_1, evidence, evidence;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log(chalk_1.default.cyan("[i] Detecting front-end framework"));
                return [4 /*yield*/, (0, makeReq_js_1.default)(url)];
            case 1:
                res = _a.sent();
                return [4 /*yield*/, puppeteer_1.default.launch({
                        headless: true,
                    })];
            case 2:
                browser = _a.sent();
                return [4 /*yield*/, browser.newPage()];
            case 3:
                page = _a.sent();
                _a.label = 4;
            case 4:
                _a.trys.push([4, 6, , 7]);
                return [4 /*yield*/, page.goto(url, {
                        waitUntil: "networkidle2",
                        timeout: 10000,
                    })];
            case 5:
                _a.sent();
                return [3 /*break*/, 7];
            case 6:
                err_1 = _a.sent();
                console.log(chalk_1.default.yellow("[!] Page load timed out, but continuing with current state"));
                return [3 /*break*/, 7];
            case 7: return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 5000); })];
            case 8:
                _a.sent();
                return [4 /*yield*/, page.content()];
            case 9:
                pageSource = _a.sent();
                return [4 /*yield*/, browser.close()];
            case 10:
                _a.sent();
                $ = cheerio.load(pageSource);
                return [4 /*yield*/, checkNextJS($)];
            case 11:
                result_checkNextJS = _a.sent();
                return [4 /*yield*/, checkVueJS($)];
            case 12:
                result_checkVueJS = _a.sent();
                return [4 /*yield*/, checkSvelte($)];
            case 13:
                result_checkSvelte = _a.sent();
                return [4 /*yield*/, res.text()];
            case 14:
                resBody = _a.sent();
                $res = cheerio.load(resBody);
                return [4 /*yield*/, checkNextJS($res)];
            case 15:
                result_checkNextJS_res = _a.sent();
                return [4 /*yield*/, checkVueJS($res)];
            case 16:
                result_checkVueJS_res = _a.sent();
                return [4 /*yield*/, checkSvelte($res)];
            case 17:
                result_checkSvelte_res = _a.sent();
                if (!(result_checkNextJS.detected === true ||
                    result_checkNextJS_res.detected === true)) return [3 /*break*/, 18];
                evidence = result_checkNextJS.evidence !== ""
                    ? result_checkNextJS.evidence
                    : result_checkNextJS_res.evidence;
                return [2 /*return*/, { name: "next", evidence: evidence }];
            case 18:
                if (!(result_checkVueJS.detected === true ||
                    result_checkVueJS_res.detected === true)) return [3 /*break*/, 21];
                console.log(chalk_1.default.green("[✓] Vue.js detected"));
                console.log(chalk_1.default.cyan("[i] Checking Nuxt.JS"), chalk_1.default.dim("(Nuxt.JS is built on Vue.js)"));
                return [4 /*yield*/, checkNuxtJS($)];
            case 19:
                result_checkNuxtJS = _a.sent();
                return [4 /*yield*/, checkNuxtJS($res)];
            case 20:
                result_checkNuxtJS_res = _a.sent();
                if (result_checkNuxtJS.detected === true ||
                    result_checkNuxtJS_res.detected === true) {
                    evidence_1 = result_checkNuxtJS.evidence !== ""
                        ? result_checkNuxtJS.evidence
                        : result_checkNuxtJS_res.evidence;
                    return [2 /*return*/, { name: "nuxt", evidence: evidence_1 }];
                }
                evidence = result_checkVueJS.evidence !== ""
                    ? result_checkVueJS.evidence
                    : result_checkVueJS_res.evidence;
                return [2 /*return*/, { name: "vue", evidence: evidence }];
            case 21:
                if (result_checkSvelte.detected === true ||
                    result_checkSvelte_res.detected === true) {
                    evidence = result_checkSvelte.evidence !== ""
                        ? result_checkSvelte.evidence
                        : result_checkSvelte_res.evidence;
                    return [2 /*return*/, { name: "svelte", evidence: evidence }];
                }
                _a.label = 22;
            case 22: return [2 /*return*/, null];
        }
    });
}); };
exports.default = frameworkDetect;
