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
var parser_1 = require("@babel/parser");
var traverse_1 = require("@babel/traverse");
var traverse = traverse_1.default.default;
var fs_1 = require("fs");
var path_1 = require("path");
var client_jsonParse = function (directory) { return __awaiter(void 0, void 0, void 0, function () {
    var foundUrls, files, _i, files_1, file, code, ast;
    return __generator(this, function (_a) {
        foundUrls = [];
        console.log(chalk_1.default.cyan("[i] Searching for client-side paths in JSON.parse()"));
        files = fs_1.default.readdirSync(directory, { recursive: true });
        files = files.filter(function (file) { return !fs_1.default.statSync(path_1.default.join(directory, file)).isDirectory(); });
        // filter out the subsequent requests files
        files = files.filter(function (file) { return !file.startsWith("___subsequent_requests"); });
        for (_i = 0, files_1 = files; _i < files_1.length; _i++) {
            file = files_1[_i];
            code = fs_1.default.readFileSync(path_1.default.join(directory, file), "utf8");
            ast = void 0;
            try {
                ast = parser_1.default.parse(code, {
                    sourceType: "unambiguous",
                    plugins: ["jsx", "typescript"],
                });
                // traverse the ast, and find all the instances where JSON.parse() is used with a string as its
                // argument, and if you parse that string, it contains paths
                traverse(ast, {
                    CallExpression: function (path) {
                        var callee = path.get("callee");
                        if (callee.matchesPattern("JSON.parse")) {
                            var args = path.get("arguments");
                            if (args.length > 0 && args[0].isStringLiteral()) {
                                var jsonString = args[0].node.value;
                                try {
                                    var parsedData = JSON.parse(jsonString);
                                    // get all the keys of parsedData
                                    var keys = Object.keys(parsedData);
                                    // check if they all match the regex of path
                                    var matched = true;
                                    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
                                        var key = keys_1[_i];
                                        if (!key.match(/^\/[\w\.\/\-]*$/)) {
                                            matched = false;
                                            break;
                                        }
                                    }
                                    if (matched) {
                                        // push all the keys to foundUrls
                                        foundUrls.push.apply(foundUrls, keys);
                                    }
                                }
                                catch (e) {
                                    // Ignore errors from JSON.parse
                                }
                            }
                        }
                    },
                });
            }
            catch (err) {
                continue;
            }
        }
        return [2 /*return*/, foundUrls];
    });
}); };
exports.default = client_jsonParse;
