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
var parser_1 = require("@babel/parser");
var traverse_1 = require("@babel/traverse");
var traverse = traverse_1.default.default;
var runSandboxed_js_1 = require("../../utility/runSandboxed.js");
var makeReq_js_1 = require("../../utility/makeReq.js");
var chalk_1 = require("chalk");
var inquirer_1 = require("inquirer");
var types_1 = require("@babel/types");
var resolvePath_js_1 = require("../../utility/resolvePath.js");
var globals = require("../../utility/globals.js");
var nuxt_astParse = function (url) { return __awaiter(void 0, void 0, void 0, function () {
    var filesFound, resp, body, ast, functions, _loop_1, _i, functions_1, func;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                filesFound = [];
                return [4 /*yield*/, (0, makeReq_js_1.default)(url)];
            case 1:
                resp = _a.sent();
                return [4 /*yield*/, resp.text()];
            case 2:
                body = _a.sent();
                try {
                    ast = parser_1.default.parse(body, {
                        sourceType: "module",
                        plugins: ["jsx", "typescript"],
                    });
                }
                catch (error) {
                    console.log(chalk_1.default.red("[!] Error parsing JS file: ", url));
                    return [2 /*return*/, filesFound];
                }
                functions = [];
                traverse(ast, {
                    FunctionDeclaration: function (path) {
                        var _a;
                        functions.push({
                            name: ((_a = path.node.id) === null || _a === void 0 ? void 0 : _a.name) || "(anonymous)",
                            type: "FunctionDeclaration",
                            source: body.slice(path.node.start, path.node.end),
                        });
                    },
                    FunctionExpression: function (path) {
                        var _a;
                        functions.push({
                            name: ((_a = path.parent.id) === null || _a === void 0 ? void 0 : _a.name) || "(anonymous)",
                            type: "FunctionExpression",
                            source: body.slice(path.node.start, path.node.end),
                        });
                    },
                    ArrowFunctionExpression: function (path) {
                        var _a;
                        functions.push({
                            name: ((_a = path.parent.id) === null || _a === void 0 ? void 0 : _a.name) || "(anonymous)",
                            type: "ArrowFunctionExpression",
                            source: body.slice(path.node.start, path.node.end),
                        });
                    },
                    ObjectMethod: function (path) {
                        functions.push({
                            name: path.node.key.name,
                            type: "ObjectMethod",
                            source: body.slice(path.node.start, path.node.end),
                        });
                    },
                    ClassMethod: function (path) {
                        functions.push({
                            name: path.node.key.name,
                            type: "ClassMethod",
                            source: body.slice(path.node.start, path.node.end),
                        });
                    },
                });
                _loop_1 = function (func) {
                    var user_verified, askCorrectFuncConfirmation, unknownVarAst, memberExpressions_1, unknownVar_1, unknownVarValue_1, funcSource, urlBuilderFunc, js_paths, integers, _b, integers_1, i, output, _c, js_paths_1, js_path, resolvedPath;
                    return __generator(this, function (_d) {
                        switch (_d.label) {
                            case 0:
                                if (!func.source.match(/"\.js".{0,15}$/)) return [3 /*break*/, 7];
                                console.log(chalk_1.default.green("[\u2713] Found JS chunk having the following source:"));
                                console.log(chalk_1.default.yellow(func.source));
                                user_verified = void 0;
                                if (!!globals.getYes()) return [3 /*break*/, 2];
                                askCorrectFuncConfirmation = function () { return __awaiter(void 0, void 0, void 0, function () {
                                    var value;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, inquirer_1.default.prompt([
                                                    {
                                                        type: "confirm",
                                                        name: "value",
                                                        message: "Is this the correct function?",
                                                        default: true,
                                                    },
                                                ])];
                                            case 1:
                                                value = (_a.sent()).value;
                                                return [2 /*return*/, value];
                                        }
                                    });
                                }); };
                                return [4 /*yield*/, askCorrectFuncConfirmation()];
                            case 1:
                                user_verified = _d.sent();
                                return [3 /*break*/, 3];
                            case 2:
                                user_verified = true;
                                _d.label = 3;
                            case 3:
                                if (user_verified === true) {
                                    console.log(chalk_1.default.cyan("[i] Proceeding with the selected function to fetch files"));
                                }
                                else {
                                    console.log(chalk_1.default.red("[!] Not executing function."));
                                    return [2 /*return*/, "continue"];
                                }
                                unknownVarAst = parser_1.default.parse("(".concat(func.source, ")"), {
                                    sourceType: "script",
                                    plugins: ["jsx", "typescript"],
                                });
                                memberExpressions_1 = [];
                                traverse(unknownVarAst, {
                                    MemberExpression: function (path) {
                                        // Only collect identifiers like f.p (not obj["x"])
                                        if (types_1.default.isIdentifier(path.node.object) &&
                                            types_1.default.isIdentifier(path.node.property) &&
                                            !path.node.computed // ignore obj["x"]
                                        ) {
                                            var objName = path.node.object.name;
                                            var propName = path.node.property.name;
                                            memberExpressions_1.push("".concat(objName, ".").concat(propName));
                                        }
                                    },
                                });
                                unknownVar_1 = memberExpressions_1[0].split(".");
                                traverse(ast, {
                                    AssignmentExpression: function (path) {
                                        var _a = path.node, left = _a.left, right = _a.right;
                                        if (types_1.default.isMemberExpression(left) &&
                                            types_1.default.isIdentifier(left.object, { name: unknownVar_1[0] }) &&
                                            types_1.default.isIdentifier(left.property, {
                                                name: unknownVar_1[1],
                                            }) &&
                                            !left.computed) {
                                            if (types_1.default.isStringLiteral(right)) {
                                                unknownVarValue_1 = right.value;
                                            }
                                            else {
                                                // fallback to source snippet
                                                unknownVarValue_1 = func.source.slice(right.start, right.end);
                                            }
                                        }
                                    },
                                });
                                funcSource = func.source.replace(new RegExp("".concat(unknownVar_1[0], ".").concat(unknownVar_1[1])), "\"".concat(unknownVarValue_1, "\""));
                                urlBuilderFunc = "(() => (".concat(funcSource, "))()");
                                js_paths = [];
                                try {
                                    integers = funcSource.match(/\d+/g);
                                    if (integers) {
                                        // Check if integers were found
                                        // iterate through all integers, and get the output
                                        for (_b = 0, integers_1 = integers; _b < integers_1.length; _b++) {
                                            i = integers_1[_b];
                                            output = (0, runSandboxed_js_1.default)(urlBuilderFunc, parseInt(i));
                                            if (output.includes("undefined")) {
                                                continue;
                                            }
                                            else {
                                                js_paths.push(output);
                                            }
                                        }
                                    }
                                }
                                catch (error) {
                                    console.log(chalk_1.default.red("[!] Error executing function: ", error));
                                }
                                if (!(js_paths.length > 0)) return [3 /*break*/, 7];
                                _c = 0, js_paths_1 = js_paths;
                                _d.label = 4;
                            case 4:
                                if (!(_c < js_paths_1.length)) return [3 /*break*/, 7];
                                js_path = js_paths_1[_c];
                                return [4 /*yield*/, (0, resolvePath_js_1.default)(url, js_path)];
                            case 5:
                                resolvedPath = _d.sent();
                                filesFound.push(resolvedPath);
                                _d.label = 6;
                            case 6:
                                _c++;
                                return [3 /*break*/, 4];
                            case 7: return [2 /*return*/];
                        }
                    });
                };
                _i = 0, functions_1 = functions;
                _a.label = 3;
            case 3:
                if (!(_i < functions_1.length)) return [3 /*break*/, 6];
                func = functions_1[_i];
                return [5 /*yield**/, _loop_1(func)];
            case 4:
                _a.sent();
                _a.label = 5;
            case 5:
                _i++;
                return [3 /*break*/, 3];
            case 6:
                if (filesFound.length > 0) {
                    console.log(chalk_1.default.green("[\u2713] Found ".concat(filesFound.length, " JS chunks")));
                }
                return [2 /*return*/, filesFound];
        }
    });
}); };
exports.default = nuxt_astParse;
