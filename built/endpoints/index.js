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
var fs_1 = require("fs");
// Next.JS
var client_subsequentRequests_js_1 = require("./next_js/client_subsequentRequests.js");
var client_jsFilesHref_js_1 = require("./next_js/client_jsFilesHref.js");
var client_jsonParse_js_1 = require("./next_js/client_jsonParse.js");
// Report Generation
var gen_markdown_js_1 = require("./gen_report/gen_markdown.js");
var gen_json_js_1 = require("./gen_report/gen_json.js");
var techs = ["Next.JS (next)"];
var outputFormats = ["md", "json"];
var endpoints = function (url, directory, output, outputFormat, tech, list, subsequentRequestsDir) { return __awaiter(void 0, void 0, void 0, function () {
    var _i, techs_1, tech_1, _a, outputFormat_1, format, final_client_side, client_subsequentRequestsResult, client_jsFilesHrefResult, client_jsonParseResult, gen_markdownResult, gen_jsonResult;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                console.log(chalk_1.default.cyan("[i] Loading endpoints module"));
                // list available technologies
                if (list) {
                    console.log(chalk_1.default.cyan("[i] Listing available technologies"));
                    for (_i = 0, techs_1 = techs; _i < techs_1.length; _i++) {
                        tech_1 = techs_1[_i];
                        console.log(chalk_1.default.greenBright("- ".concat(tech_1)));
                    }
                    return [2 /*return*/];
                }
                // iterate over the output format, and match it with the available output formats
                for (_a = 0, outputFormat_1 = outputFormat; _a < outputFormat_1.length; _a++) {
                    format = outputFormat_1[_a];
                    if (!outputFormats.includes(format)) {
                        console.log(chalk_1.default.red("[!] Invalid output format"));
                        return [2 /*return*/];
                    }
                }
                // check if the directory is present
                if (!directory) {
                    console.log(chalk_1.default.red("[!] Please provide a directory"));
                    return [2 /*return*/];
                }
                // check if the technology is present
                if (!tech) {
                    console.log(chalk_1.default.red("[!] Please provide a technology"));
                    return [2 /*return*/];
                }
                // check if the output file is present
                if (!output) {
                    console.log(chalk_1.default.red("[!] Please provide an output file"));
                    return [2 /*return*/];
                }
                // check if the url is present
                if (!url) {
                    console.log(chalk_1.default.red("[!] Please provide a URL"));
                    return [2 /*return*/];
                }
                console.log(chalk_1.default.cyan("[i] Extracting endpoints"));
                if (!(tech === "next")) return [3 /*break*/, 7];
                console.log(chalk_1.default.cyan("[i] Checking for client-side paths for Next.JS"));
                // check if the subsequent requests directory is present
                if (!subsequentRequestsDir) {
                    console.log(chalk_1.default.red("[!] Please provide a directory containing subsequent requests (--subsequent-requests-dir)"));
                    return [2 /*return*/];
                }
                // check if the subsequent requests directory exists
                if (!fs_1.default.existsSync(subsequentRequestsDir)) {
                    console.log(chalk_1.default.red("[!] Directory containing subsequent requests does not exist"));
                    return [2 /*return*/];
                }
                final_client_side = [];
                return [4 /*yield*/, (0, client_subsequentRequests_js_1.default)(subsequentRequestsDir, url)];
            case 1:
                client_subsequentRequestsResult = _b.sent();
                final_client_side.push.apply(final_client_side, client_subsequentRequestsResult);
                return [4 /*yield*/, (0, client_jsFilesHref_js_1.default)(directory)];
            case 2:
                client_jsFilesHrefResult = _b.sent();
                final_client_side.push.apply(final_client_side, client_jsFilesHrefResult);
                return [4 /*yield*/, (0, client_jsonParse_js_1.default)(directory)];
            case 3:
                client_jsonParseResult = _b.sent();
                final_client_side.push.apply(final_client_side, client_jsonParseResult);
                if (!outputFormat.includes("md")) return [3 /*break*/, 5];
                return [4 /*yield*/, (0, gen_markdown_js_1.default)(url, final_client_side, output)];
            case 4:
                gen_markdownResult = _b.sent();
                _b.label = 5;
            case 5:
                if (!outputFormat.includes("json")) return [3 /*break*/, 7];
                return [4 /*yield*/, (0, gen_json_js_1.default)(url, final_client_side, output)];
            case 6:
                gen_jsonResult = _b.sent();
                _b.label = 7;
            case 7: return [2 /*return*/];
        }
    });
}); };
exports.default = endpoints;
