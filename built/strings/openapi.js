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
var promises_1 = require("fs/promises");
var openapi = function (paths, output_file) { return __awaiter(void 0, void 0, void 0, function () {
    var openapiData, _i, paths_1, p, pathKey, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log(chalk_1.default.cyan("[i] Generating OpenAPI v3 file"));
                openapiData = {
                    openapi: "3.0.0",
                    info: {
                        title: "API Collection",
                        description: "A collection of API endpoints discovered by js-recon.",
                        version: "1.0.0",
                    },
                    servers: [
                        {
                            url: "{{baseUrl}}",
                            description: "Base URL for the API",
                        },
                    ],
                    paths: {},
                };
                for (_i = 0, paths_1 = paths; _i < paths_1.length; _i++) {
                    p = paths_1[_i];
                    pathKey = p.startsWith("/") ? p : "/".concat(p);
                    if (!openapiData.paths[pathKey]) {
                        openapiData.paths[pathKey] = {};
                    }
                    // Assuming GET method for all paths for now.
                    // This can be expanded later.
                    openapiData.paths[pathKey].get = {
                        summary: "Discovered endpoint: ".concat(pathKey),
                        description: "An endpoint discovered at ".concat(pathKey, "."),
                        responses: {
                            200: {
                                description: "Successful response. The actual response will vary.",
                            },
                        },
                    };
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, (0, promises_1.writeFile)("".concat(output_file, "-swagger.json"), JSON.stringify(openapiData, null, 2))];
            case 2:
                _a.sent();
                console.log(chalk_1.default.green("[\u2713] OpenAPI v3 file saved to: ".concat(output_file, "-swagger.json")));
                return [3 /*break*/, 4];
            case 3:
                error_1 = _a.sent();
                console.error(chalk_1.default.red("[!] Error writing OpenAPI file: ".concat(error_1.message)));
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.default = openapi;
