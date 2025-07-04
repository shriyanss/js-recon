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
var path_1 = require("path");
var parser_1 = require("@babel/parser");
var traverse_1 = require("@babel/traverse");
var makeReq_js_1 = require("../../utility/makeReq.js");
var traverse = traverse_1.default.default;
var toReturn = [];
var checkHref = function (files, url) { return __awaiter(void 0, void 0, void 0, function () {
    var _loop_1, _i, files_1, file;
    return __generator(this, function (_a) {
        _loop_1 = function (file) {
            var content = fs_1.default.readFileSync(file, "utf-8");
            // go through each line
            var lines = content.split("\n");
            var _loop_2 = function (line) {
                // check what is the type of line's content by matching it against regex
                if (line.match(/^[0-9a-z]+:I\[.+/)) {
                    return "continue";
                    // } else if (line.match(/^[0-9a-z\s\.]+:([A-Za-z0-9\,\.\s\-]+:)?[\[\{].+/)) {
                }
                else if (line.match(/^[0-9a-z]+:\[.+/)) {
                    // extract the JS code. i.e. between [ and ]
                    var jsCode_1;
                    try {
                        jsCode_1 = "[".concat(line.match(/\[(.+)\]/)[1], "]");
                    }
                    catch (err) {
                        return "continue";
                    }
                    // parse JS code with ast
                    var ast = void 0;
                    try {
                        ast = parser_1.default.parse(jsCode_1, {
                            sourceType: "unambiguous",
                            plugins: ["jsx", "typescript"],
                        });
                    }
                    catch (err) {
                        return "continue";
                    }
                    // traverse the ast, and find the objects with href, and external
                    var finds_2 = [];
                    traverse(ast, {
                        ObjectExpression: function (path) {
                            var properties = path.node.properties;
                            var hasHrefOrUrl = false;
                            var hasExternal = false;
                            var hasChildren = false;
                            var hrefValue = null;
                            var externalValue = null;
                            for (var _i = 0, properties_1 = properties; _i < properties_1.length; _i++) {
                                var prop = properties_1[_i];
                                var prop_name = jsCode_1.substring(prop.key.start, prop.key.end);
                                if (prop_name === '"href"') {
                                    hasHrefOrUrl = true;
                                    hrefValue = jsCode_1
                                        .substring(prop.value.start, prop.value.end)
                                        .replace(/^"|"$/g, "");
                                }
                                if (prop_name === '"external"') {
                                    hasExternal = true;
                                    externalValue = jsCode_1
                                        .substring(prop.value.start, prop.value.end)
                                        .replace(/^"|"$/g, "");
                                }
                                if (prop_name === '"children"') {
                                    hasChildren = true;
                                }
                            }
                            if (hasHrefOrUrl) {
                                if ((hasExternal || hasChildren) &&
                                    !hrefValue.startsWith("#")) {
                                    // if the path doesn't starts with a `/`, then resolve the path
                                    if (!hrefValue.startsWith("/") &&
                                        !hrefValue.startsWith("http")) {
                                        var path_2 = file
                                            .replace(/output\/[a-zA-Z0-9_\.\-]+\/___subsequent_requests\//, "/")
                                            .split("/");
                                        // remove the last one
                                        path_2.pop();
                                        path_2 = path_2.join("/");
                                        var fileUrl = url + path_2;
                                        // now, resolve the path
                                        var resolvedPath = new URL(hrefValue, fileUrl).href;
                                        finds_2.push({
                                            href: resolvedPath,
                                            external: externalValue,
                                        });
                                    }
                                    else {
                                        finds_2.push({
                                            href: hrefValue,
                                            external: externalValue,
                                        });
                                    }
                                }
                            }
                        },
                    });
                    // // iterate through the finds and resolve the paths
                    // for (const find of finds) {
                    //   console.log(find);
                    //   report += `### ${find.href}\n`;
                    //   report += `${find.external}\n`;
                    // }
                    for (var _c = 0, finds_1 = finds_2; _c < finds_1.length; _c++) {
                        var find = finds_1[_c];
                        toReturn.push(find.href);
                    }
                }
                else {
                    return "continue";
                }
            };
            for (var _b = 0, lines_1 = lines; _b < lines_1.length; _b++) {
                var line = lines_1[_b];
                _loop_2(line);
            }
        };
        // open each file and read the contents
        for (_i = 0, files_1 = files; _i < files_1.length; _i++) {
            file = files_1[_i];
            _loop_1(file);
        }
        return [2 /*return*/];
    });
}); };
var checkSlug = function (files, url) { return __awaiter(void 0, void 0, void 0, function () {
    var _loop_3, _i, files_2, file;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _loop_3 = function (file) {
                    var content, lines, _loop_4, _b, lines_2, line;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                content = fs_1.default.readFileSync(file, "utf-8");
                                lines = content.split("\n");
                                _loop_4 = function (line) {
                                    var jsCode, jsonObject, slugUrls_2, traverse_2, _d, slugUrls_1, path_3, res, statusCode;
                                    return __generator(this, function (_e) {
                                        switch (_e.label) {
                                            case 0:
                                                if (!line.match(/^[0-9a-z]+:I\[.+/)) return [3 /*break*/, 1];
                                                return [2 /*return*/, "continue"];
                                            case 1:
                                                if (!line.match(/^[0-9a-z]+:\[.+/)) return [3 /*break*/, 6];
                                                jsCode = void 0;
                                                try {
                                                    jsCode = "[".concat(line.match(/\[(.+)\]/)[1], "]");
                                                }
                                                catch (err) {
                                                    return [2 /*return*/, "continue"];
                                                }
                                                jsonObject = void 0;
                                                try {
                                                    jsonObject = JSON.parse(jsCode);
                                                }
                                                catch (error) {
                                                    return [2 /*return*/, "continue"];
                                                }
                                                slugUrls_2 = [];
                                                traverse_2 = function (obj) {
                                                    if (obj && typeof obj === "object") {
                                                        if (obj.slug) {
                                                            var slugUrl = new URL(obj.slug, file.replace(/output\/[a-zA-Z0-9_\.\-]+\/___subsequent_requests\//, url + "/")).href;
                                                            slugUrls_2.push(slugUrl);
                                                        }
                                                        Object.values(obj).forEach(function (value) { return traverse_2(value); });
                                                    }
                                                };
                                                traverse_2(jsonObject);
                                                _d = 0, slugUrls_1 = slugUrls_2;
                                                _e.label = 2;
                                            case 2:
                                                if (!(_d < slugUrls_1.length)) return [3 /*break*/, 5];
                                                path_3 = slugUrls_1[_d];
                                                return [4 /*yield*/, (0, makeReq_js_1.default)(path_3)];
                                            case 3:
                                                res = _e.sent();
                                                statusCode = res.status;
                                                if (statusCode !== 404) {
                                                    toReturn.push(path_3);
                                                }
                                                _e.label = 4;
                                            case 4:
                                                _d++;
                                                return [3 /*break*/, 2];
                                            case 5: return [3 /*break*/, 7];
                                            case 6: return [2 /*return*/, "continue"];
                                            case 7: return [2 /*return*/];
                                        }
                                    });
                                };
                                _b = 0, lines_2 = lines;
                                _c.label = 1;
                            case 1:
                                if (!(_b < lines_2.length)) return [3 /*break*/, 4];
                                line = lines_2[_b];
                                return [5 /*yield**/, _loop_4(line)];
                            case 2:
                                _c.sent();
                                _c.label = 3;
                            case 3:
                                _b++;
                                return [3 /*break*/, 1];
                            case 4: return [2 /*return*/];
                        }
                    });
                };
                _i = 0, files_2 = files;
                _a.label = 1;
            case 1:
                if (!(_i < files_2.length)) return [3 /*break*/, 4];
                file = files_2[_i];
                return [5 /*yield**/, _loop_3(file)];
            case 2:
                _a.sent();
                _a.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4: return [2 /*return*/];
        }
    });
}); };
var client_subsequentRequests = function (subsequentRequestsDir, url) { return __awaiter(void 0, void 0, void 0, function () {
    var walkSync, files;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                //   let report = `## Subsequent Requests\n`;
                console.log(chalk_1.default.cyan("[i] Using subsequent requests file method"));
                walkSync = function (dir, files) {
                    if (files === void 0) { files = []; }
                    fs_1.default.readdirSync(dir).forEach(function (file) {
                        var dirFile = path_1.default.join(dir, file);
                        if (fs_1.default.statSync(dirFile).isDirectory()) {
                            walkSync(dirFile, files);
                        }
                        else {
                            files.push(dirFile);
                        }
                    });
                    return files;
                };
                files = walkSync(subsequentRequestsDir);
                return [4 /*yield*/, checkHref(files, url)];
            case 1:
                _a.sent();
                // await checkSlug(files, url);
                return [2 /*return*/, toReturn];
        }
    });
}); };
exports.default = client_subsequentRequests;
