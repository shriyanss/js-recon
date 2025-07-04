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
// Next.JS
var getWebpackConnections_js_1 = require("./next_js/getWebpackConnections.js");
var getFetchInstances_js_1 = require("./next_js/getFetchInstances.js");
var resolveFetch_js_1 = require("./next_js/resolveFetch.js");
var interactive_js_1 = require("./next_js/interactive.js");
var availableTech = {
    next: "Next.JS",
};
var availableFormats = {
    json: "JSON",
};
var map = function (directory, output, formats, tech, list, interactive_mode) { return __awaiter(void 0, void 0, void 0, function () {
    var _i, _a, _b, key, value, _c, formats_1, format, chunks;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                console.log(chalk_1.default.cyan("[i] Running 'map' module"));
                if (list) {
                    console.log(chalk_1.default.cyan("Available technologies:"));
                    for (_i = 0, _a = Object.entries(availableTech); _i < _a.length; _i++) {
                        _b = _a[_i], key = _b[0], value = _b[1];
                        console.log(chalk_1.default.cyan("- '".concat(key, "': ").concat(value)));
                    }
                    return [2 /*return*/];
                }
                // iterate through all the formats, and match it with the available formats
                for (_c = 0, formats_1 = formats; _c < formats_1.length; _c++) {
                    format = formats_1[_c];
                    if (!Object.keys(availableFormats).includes(format)) {
                        console.log(chalk_1.default.red("[!] Invalid format: ".concat(format)));
                        return [2 /*return*/];
                    }
                }
                if (!tech) {
                    console.log(chalk_1.default.red("[!] Please specify a technology with -t/--tech. Run with -l/--list to see available technologies"));
                    return [2 /*return*/];
                }
                if (!directory) {
                    console.log(chalk_1.default.red("[!] Please specify a directory with -d/--directory"));
                    return [2 /*return*/];
                }
                if (!(tech === "next")) return [3 /*break*/, 5];
                return [4 /*yield*/, (0, getWebpackConnections_js_1.default)(directory, output, formats)];
            case 1:
                chunks = _d.sent();
                return [4 /*yield*/, (0, getFetchInstances_js_1.default)(chunks, output, formats)];
            case 2:
                // now, iterate through them, and check fetch instances
                chunks = _d.sent();
                // resolve fetch once you've got all
                return [4 /*yield*/, (0, resolveFetch_js_1.default)(chunks, directory, formats)];
            case 3:
                // resolve fetch once you've got all
                _d.sent();
                if (!interactive_mode) return [3 /*break*/, 5];
                return [4 /*yield*/, (0, interactive_js_1.default)(chunks)];
            case 4:
                _d.sent();
                _d.label = 5;
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.default = map;
