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
var fs_1 = require("fs");
var path_1 = require("path");
var parser_1 = require("@babel/parser");
var traverse_1 = require("@babel/traverse");
var traverse = traverse_1.default.default;
var chalk_1 = require("chalk");
var globals = require("../../utility/globals.js");
var ai_js_1 = require("../../utility/ai.js");
var getWebpackConnections = function (directory, output, formats) { return __awaiter(void 0, void 0, void 0, function () {
    var maxAiThreads, provider, apiKey, chunks_1, files, chunks, _loop_1, _i, files_1, file, _loop_2, _a, _b, _c, key, value, chunkEntries, descriptionPromises, activeThreads_1, sleep, systemPrompt_1, _loop_3, _d, chunkEntries_1, _e, key, value, results, chunks_json;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                maxAiThreads = globals.getAiThreads();
                if (globals.getAi().length > 0) {
                    // print a warning message about costs that might incur
                    console.log(chalk_1.default.yellow("[!] AI integration is enabled. This may incur costs. By using this feature, you agree to the AI provider's terms of service, and accept the risk of incurring unexpected costs due to huge codebase."));
                    provider = globals.getAiServiceProvider();
                    if (provider === "openai") {
                        apiKey = globals.getOpenaiApiKey() || process.env.OPENAI_API_KEY;
                        if (!apiKey) {
                            console.log(chalk_1.default.red("[!] OpenAI API key not found. Please provide it via --openai-api-key or OPENAI_API_KEY environment variable."));
                            process.exit(1);
                        }
                    }
                    console.log(chalk_1.default.cyan("[i] AI provider \"".concat(provider, "\" initialized.")));
                }
                // if the output file already exists, and AI mode is enabled, skip coz it burns $$$
                if (fs_1.default.existsSync("".concat(output, ".json")) && globals.getAi()) {
                    console.log(chalk_1.default.yellow("[!] Output file ".concat(output, ".json already exists. Skipping regeneration to save costs.")));
                    chunks_1 = JSON.parse(fs_1.default.readFileSync("".concat(output, ".json"), "utf8"));
                    return [2 /*return*/, chunks_1];
                }
                console.log(chalk_1.default.cyan("[i] Getting webpack connections"));
                files = fs_1.default.readdirSync(directory, { recursive: true });
                // remove all subsequent requests file from the list
                files = files.filter(function (file) {
                    return !file.includes("___subsequent_requests");
                });
                // remove all directories from the list
                files = files.filter(function (file) {
                    return !fs_1.default.lstatSync(path_1.default.join(directory, file)).isDirectory();
                });
                chunks = {};
                _loop_1 = function (file) {
                    // if the first three lines of the file doesn't contain `self.webpackChunk_N_E`, continue
                    var firstThreeLines = fs_1.default
                        .readFileSync(path_1.default.join(directory, file), "utf8")
                        .split("\n")
                        .slice(0, 3);
                    if (!firstThreeLines.some(function (line) {
                        return line.includes("self.webpackChunk_N_E");
                    })) {
                        return "continue";
                    }
                    // read the file
                    var code = fs_1.default.readFileSync(path_1.default.join(directory, file), "utf8");
                    // parse the code with ast
                    var ast = void 0;
                    try {
                        ast = parser_1.default.parse(code, {
                            sourceType: "unambiguous",
                            plugins: ["jsx", "typescript"],
                        });
                    }
                    catch (err) {
                        return "continue";
                    }
                    // traverse the ast
                    traverse(ast, {
                        CallExpression: function (path) {
                            var callee = path.get("callee");
                            // check if the call expression is a push to a webpack chunk
                            if (!callee.isMemberExpression() ||
                                !callee.get("property").isIdentifier({ name: "push" })) {
                                return;
                            }
                            var object = callee.get("object");
                            if (object.isAssignmentExpression()) {
                                object = object.get("left");
                            }
                            if (!(object.isMemberExpression() &&
                                object.get("property").isIdentifier() &&
                                object
                                    .get("property")
                                    .node.name.startsWith("webpackChunk"))) {
                                return;
                            }
                            // get the first argument of the push call
                            var arg = path.get("arguments.0");
                            if (!arg || !arg.isArrayExpression()) {
                                return;
                            }
                            // find the object expression in the arguments
                            var elements = arg.get("elements");
                            for (var _i = 0, elements_1 = elements; _i < elements_1.length; _i++) {
                                var element = elements_1[_i];
                                if (element.isObjectExpression()) {
                                    var properties = element.get("properties");
                                    for (var _a = 0, properties_1 = properties; _a < properties_1.length; _a++) {
                                        var prop = properties_1[_a];
                                        if (prop.isObjectProperty()) {
                                            var key = prop.get("key");
                                            if (key.isNumericLiteral() ||
                                                key.isStringLiteral()) {
                                                var keyValue = key.node.value;
                                                var function_code = code
                                                    .slice(prop.node.start, prop.node.end)
                                                    .replace(/^\s*[\w\d]+:\s+function\s+/, "function webpack_".concat(keyValue, " "))
                                                    .replace(/^s*[\w\d]+:\s\(/, "func_".concat(keyValue, " = ("));
                                                chunks[keyValue] = {
                                                    id: keyValue,
                                                    description: "none",
                                                    loadedOn: [],
                                                    containsFetch: false,
                                                    exports: "string",
                                                    callStack: [],
                                                    code: function_code,
                                                    imports: [],
                                                    file: file,
                                                };
                                            }
                                        }
                                    }
                                }
                            }
                        },
                    });
                };
                // read all the files, and get the chunks
                for (_i = 0, files_1 = files; _i < files_1.length; _i++) {
                    file = files_1[_i];
                    _loop_1(file);
                }
                // now, iterate through every chunk, and find the imports in the function
                console.log(chalk_1.default.cyan("[i] Finding imports for chunks"));
                _loop_2 = function (key, value) {
                    var ast = void 0;
                    try {
                        ast = parser_1.default.parse(value.code, {
                            sourceType: "unambiguous",
                            plugins: ["jsx", "typescript"],
                        });
                    }
                    catch (err) {
                        return "continue";
                    }
                    // if the function has three arguments, get the name of the third argument
                    var thirdArgName;
                    traverse(ast, {
                        FunctionDeclaration: function (path) {
                            var args = path.get("params");
                            if (args.length === 3) {
                                thirdArgName = args[2].node.name;
                            }
                        },
                    });
                    // if the function doesn't have three arguments, continue
                    if (!thirdArgName) {
                        return "continue";
                    }
                    // if the thirs argument, i.e. __webpack_require__ is present, then see if it is used
                    // if yes, print the chunk name
                    traverse(ast, {
                        CallExpression: function (path) {
                            var callee = path.get("callee");
                            if (callee.isIdentifier({ name: thirdArgName })) {
                                // the id of the function
                                var id = path.get("arguments.0");
                                if (id) {
                                    if (id.node.value !== undefined &&
                                        String(id.node.value).match(/^\d+$/) &&
                                        id.node.value !== "") {
                                        chunks[key].imports.push(String(id.node.value));
                                    }
                                }
                            }
                        },
                    });
                };
                for (_a = 0, _b = Object.entries(chunks); _a < _b.length; _a++) {
                    _c = _b[_a], key = _c[0], value = _c[1];
                    _loop_2(key, value);
                }
                if (!(globals.getAi() && globals.getAi().includes("description"))) return [3 /*break*/, 6];
                console.log(chalk_1.default.cyan("[i] Generating descriptions for chunks"));
                chunkEntries = Object.entries(chunks);
                descriptionPromises = [];
                activeThreads_1 = 0;
                sleep = function (ms) { return new Promise(function (resolve) { return setTimeout(resolve, ms); }); };
                systemPrompt_1 = "You are a code analyzer. You will be given a function from the webpack of a compiled Next.JS file. You have to generate a one-liner description of what the function does.";
                _loop_3 = function (key, value) {
                    var promise;
                    return __generator(this, function (_g) {
                        switch (_g.label) {
                            case 0:
                                if (!(activeThreads_1 >= maxAiThreads)) return [3 /*break*/, 2];
                                return [4 /*yield*/, sleep(Math.floor(Math.random() * 451) + 50)];
                            case 1:
                                _g.sent(); // Sleep for 50-500ms
                                return [3 /*break*/, 0];
                            case 2:
                                activeThreads_1++;
                                promise = (function () { return __awaiter(void 0, void 0, void 0, function () {
                                    var description, err_1;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                _a.trys.push([0, 2, 3, 4]);
                                                return [4 /*yield*/, (0, ai_js_1.getCompletion)(value.code, systemPrompt_1)];
                                            case 1:
                                                description = _a.sent();
                                                return [2 /*return*/, { key: key, description: description }];
                                            case 2:
                                                err_1 = _a.sent();
                                                console.log(chalk_1.default.red("[!] Error generating description for chunk ".concat(key, ": ").concat(err_1.message)));
                                                return [2 /*return*/, { key: key, description: "none" }];
                                            case 3:
                                                activeThreads_1--;
                                                return [7 /*endfinally*/];
                                            case 4: return [2 /*return*/];
                                        }
                                    });
                                }); })();
                                descriptionPromises.push(promise);
                                return [2 /*return*/];
                        }
                    });
                };
                _d = 0, chunkEntries_1 = chunkEntries;
                _f.label = 1;
            case 1:
                if (!(_d < chunkEntries_1.length)) return [3 /*break*/, 4];
                _e = chunkEntries_1[_d], key = _e[0], value = _e[1];
                return [5 /*yield**/, _loop_3(key, value)];
            case 2:
                _f.sent();
                _f.label = 3;
            case 3:
                _d++;
                return [3 /*break*/, 1];
            case 4: return [4 /*yield*/, Promise.all(descriptionPromises)];
            case 5:
                results = _f.sent();
                results.forEach(function (_a) {
                    var key = _a.key, description = _a.description;
                    if (chunks[key]) {
                        chunks[key].description = description || "none";
                        console.log(chalk_1.default.green("[\u2713] Generated description for ".concat(key, ": ").concat(chunks[key].description)));
                    }
                });
                _f.label = 6;
            case 6:
                console.log(chalk_1.default.green("[\u2713] Found ".concat(Object.keys(chunks).length, " webpack functions")));
                if (formats.includes("json")) {
                    chunks_json = JSON.stringify(chunks, null, 2);
                    fs_1.default.writeFileSync("".concat(output, ".json"), chunks_json);
                    console.log(chalk_1.default.green("[\u2713] Saved webpack connections to ".concat(output, ".json")));
                }
                return [2 /*return*/, chunks];
        }
    });
}); };
exports.default = getWebpackConnections;
