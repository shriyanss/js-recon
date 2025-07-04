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
var index_js_1 = require("../endpoints/index.js");
var index_js_2 = require("../strings/index.js");
var index_js_3 = require("../map/index.js");
var globals = require("../utility/globals.js");
var fs_1 = require("fs");
var index_js_4 = require("../lazyLoad/index.js");
var chalk_1 = require("chalk");
exports.default = (function (cmd) { return __awaiter(void 0, void 0, void 0, function () {
    var targetHost;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                globals.setApiGatewayConfigFile(cmd.apiGatewayConfig);
                globals.setUseApiGateway(cmd.apiGateway);
                globals.setDisableCache(cmd.disableCache);
                globals.setRespCacheFile(cmd.cacheFile);
                globals.setYes(cmd.yes);
                targetHost = new URL(cmd.url).host;
                console.log(chalk_1.default.bgGreenBright("[+] Starting analysis..."));
                console.log(chalk_1.default.bgCyan("[1/6] Running lazyload to download JavaScript files..."));
                return [4 /*yield*/, (0, index_js_4.default)(cmd.url, cmd.output, cmd.strictScope, cmd.scope.split(","), cmd.threads, false, "")];
            case 1:
                _a.sent();
                console.log(chalk_1.default.bgGreen("[+] Lazyload complete."));
                // globals.setTech("next");
                // if tech is undefined, i.e. it can't be detected, quit. Nothing to be done :(
                if (!globals.getTech()) {
                    console.log(chalk_1.default.bgRed("[!] Technology not detected. Quitting."));
                    return [2 /*return*/];
                }
                // run strings
                console.log(chalk_1.default.bgCyan("[2/6] Running strings to extract endpoints..."));
                return [4 /*yield*/, (0, index_js_2.default)(cmd.output, "strings.json", true, "extracted_urls", false, false, false)];
            case 2:
                _a.sent();
                console.log(chalk_1.default.bgGreen("[+] Strings complete."));
                // run lazyload with subsequent requests
                console.log(chalk_1.default.bgCyan("[3/6] Running lazyload with subsequent requests to download JavaScript files..."));
                return [4 /*yield*/, (0, index_js_4.default)(cmd.url, cmd.output, cmd.strictScope, cmd.scope.split(","), cmd.threads, true, "extracted_urls.json")];
            case 3:
                _a.sent();
                console.log(chalk_1.default.bgGreen("[+] Lazyload with subsequent requests complete."));
                // run strings again to extract endpoints from the files that are downloaded in the previous step
                console.log(chalk_1.default.bgCyan("[4/6] Running strings again to extract endpoints..."));
                return [4 /*yield*/, (0, index_js_2.default)(cmd.output, "strings.json", true, "extracted_urls", cmd.secrets, true, true)];
            case 4:
                _a.sent();
                console.log(chalk_1.default.bgGreen("[+] Strings complete."));
                // now, run endpoints
                console.log(chalk_1.default.bgCyan("[5/6] Running endpoints to extract endpoints..."));
                if (!fs_1.default.existsSync("output/".concat(targetHost, "/___subsequent_requests"))) return [3 /*break*/, 6];
                return [4 /*yield*/, (0, index_js_1.default)(cmd.url, cmd.output, "strings", ["json"], globals.getTech(), false, "output/".concat(targetHost, "/___subsequent_requests"))];
            case 5:
                _a.sent();
                console.log(chalk_1.default.bgGreen("[+] Endpoints complete."));
                return [3 /*break*/, 7];
            case 6:
                console.log(chalk_1.default.bgYellow("[!] Subsequent requests directory does not exist. Skipping endpoints."));
                _a.label = 7;
            case 7:
                // now, run map
                console.log(chalk_1.default.bgCyan("[6/6] Running map to find functions..."));
                return [4 /*yield*/, (0, index_js_3.default)(cmd.output, "mapped", ["json"], globals.getTech(), false, false)];
            case 8:
                _a.sent();
                console.log(chalk_1.default.bgGreen("[+] Map complete."));
                console.log(chalk_1.default.bgGreenBright("[+] Analysis complete."));
                return [2 /*return*/];
        }
    });
}); });
