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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var chalk_1 = require("chalk");
var fs_1 = require("fs");
var path_1 = require("path");
var parser_1 = require("@babel/parser");
var prettier_1 = require("prettier");
var secrets_js_1 = require("./secrets.js");
var permutate_js_1 = require("./permutate.js");
var openapi_js_1 = require("./openapi.js");
/**
 * Recursively extracts strings from a babel AST node.
 * This is a deeper search than just StringLiterals.
 * @param {object} node - The AST node to traverse.
 * @returns {string[]} - An array of extracted strings.
 */
function extractStrings(node) {
    var strings = new Set();
    var seen = new WeakSet();
    function recurse(currentNode) {
        if (!currentNode ||
            typeof currentNode !== "object" ||
            seen.has(currentNode)) {
            return;
        }
        seen.add(currentNode);
        if (Array.isArray(currentNode)) {
            currentNode.forEach(function (item) { return recurse(item); });
            return;
        }
        if (currentNode.type === "StringLiteral") {
            strings.add(currentNode.value);
        }
        else if (currentNode.type === "TemplateLiteral") {
            currentNode.quasis.forEach(function (q) {
                if (q.value.cooked) {
                    strings.add(q.value.cooked);
                }
            });
        }
        Object.keys(currentNode).forEach(function (key) {
            // Avoid traversing location properties and other non-node properties
            if ([
                "loc",
                "start",
                "end",
                "extra",
                "raw",
                "comments",
                "leadingComments",
                "trailingComments",
                "innerComments",
            ].includes(key))
                return;
            recurse(currentNode[key]);
        });
    }
    recurse(node);
    return Array.from(strings);
}
/**
 * Extracts all string literals from all .js files in a given directory and its
 * subdirectories and writes them to a JSON file.
 * @param {string} directory - The directory to scan for .js files
 * @param {string} output_file - The file to write the extracted strings to
 */
var strings = function (directory, output_file, extract_urls, extracted_url_path, scan_secrets, permutate_option, openapi_option) { return __awaiter(void 0, void 0, void 0, function () {
    var files, jsFiles, js_files_path, _i, jsFiles_1, file, filePath, all_strings, _a, js_files_path_1, file, lines, strings_1, _b, lines_1, line, jsCode, ast, extracted, fileContent, ast, strings_count, _c, _d, file, formatted, urls, paths, _e, _f, file, _g, _h, string, formatted_urls, total_secrets, _j, js_files_path_2, file, fileContent, foundSecrets, _k, foundSecrets_1, foundSecret;
    return __generator(this, function (_l) {
        switch (_l.label) {
            case 0:
                console.log(chalk_1.default.cyan("[i] Loading 'Strings' module"));
                // check if the directory exists
                if (!fs_1.default.existsSync(directory)) {
                    console.log(chalk_1.default.red("[!] Directory does not exist"));
                    return [2 /*return*/];
                }
                console.log(chalk_1.default.cyan("[i] Scanning ".concat(directory, " directory")));
                files = fs_1.default.readdirSync(directory, { recursive: true });
                jsFiles = files.filter(function (file) { return file.endsWith(".js"); });
                js_files_path = [];
                for (_i = 0, jsFiles_1 = jsFiles; _i < jsFiles_1.length; _i++) {
                    file = jsFiles_1[_i];
                    filePath = path_1.default.join(directory, file);
                    if (!fs_1.default.lstatSync(filePath).isDirectory()) {
                        js_files_path.push(filePath);
                    }
                }
                console.log(chalk_1.default.cyan("[i] Found ".concat(js_files_path.length, " JS files")));
                all_strings = {};
                for (_a = 0, js_files_path_1 = js_files_path; _a < js_files_path_1.length; _a++) {
                    file = js_files_path_1[_a];
                    if (file.includes("___subsequent_requests")) {
                        lines = fs_1.default.readFileSync(file, "utf-8").split("\n");
                        strings_1 = [];
                        for (_b = 0, lines_1 = lines; _b < lines_1.length; _b++) {
                            line = lines_1[_b];
                            // if the line matches with a particular regex, then extract the JS snippet
                            if (line.match(/^[0-9a-z]+:\[.+/)) {
                                jsCode = void 0;
                                try {
                                    jsCode = "[".concat(line.match(/\[(.+)\]/)[1], "]");
                                }
                                catch (err) {
                                    continue;
                                }
                                ast = void 0;
                                try {
                                    ast = parser_1.default.parse(jsCode, {
                                        sourceType: "unambiguous",
                                        plugins: ["jsx", "typescript"],
                                    });
                                }
                                catch (err) {
                                    continue;
                                }
                                extracted = extractStrings(ast);
                                strings_1.push.apply(strings_1, extracted);
                            }
                        }
                        all_strings[file] = strings_1;
                    }
                    else {
                        fileContent = fs_1.default.readFileSync(file, "utf-8");
                        ast = parser_1.default.parse(fileContent, {
                            sourceType: "unambiguous",
                            plugins: ["jsx", "typescript"],
                        });
                        all_strings[file] = extractStrings(ast);
                    }
                }
                strings_count = 0;
                for (_c = 0, _d = Object.keys(all_strings); _c < _d.length; _c++) {
                    file = _d[_c];
                    strings_count += all_strings[file].length;
                }
                console.log(chalk_1.default.cyan("[i] Extracted ".concat(strings_count, " strings")));
                return [4 /*yield*/, prettier_1.default.format(JSON.stringify(all_strings), {
                        parser: "json",
                        printWidth: 80,
                        singleQuote: true,
                    })];
            case 1:
                formatted = _l.sent();
                fs_1.default.writeFileSync(output_file, formatted);
                console.log(chalk_1.default.green("[\u2713] Extracted strings to ".concat(output_file)));
                // if -p is enabled, but not -e, or the same case with the --openapi flag
                if ((permutate_option && !extract_urls) ||
                    (openapi_option && !extract_urls)) {
                    console.log(chalk_1.default.red("[!] Please enable -e flag for -p or --openapi flag"));
                    return [2 /*return*/];
                }
                if (!extract_urls) return [3 /*break*/, 6];
                console.log(chalk_1.default.cyan("[i] Extracting URLs and paths from strings"));
                urls = [];
                paths = [];
                for (_e = 0, _f = Object.keys(all_strings); _e < _f.length; _e++) {
                    file = _f[_e];
                    for (_g = 0, _h = all_strings[file]; _g < _h.length; _g++) {
                        string = _h[_g];
                        if (string.match(/^https?:\/\/[a-zA-Z0-9\.\-_]+\/?.*$/)) {
                            // like https://site.com
                            urls.push(string);
                        }
                        if (string.match(/^\/.+$/)) {
                            // like /path/resource
                            // make sure that the path doesn't start with two special chars except '/_'
                            if (string.match(/^\/[^a-zA-Z0-9]/) &&
                                !string.startsWith("/_")) {
                                // ignore the path
                            }
                            else {
                                paths.push(string);
                            }
                        }
                        if (string.match(/^[a-zA-Z0-9_\-]\/[a-zA-Z0-9_\-].*$/)) {
                            // like path/to/resource
                            paths.push(string);
                        }
                        if (string.startsWith("./") || string.startsWith("../")) {
                            // like "./path/to/resource" or "../path/to/resource"
                            paths.push(string);
                        }
                    }
                }
                // dedupe the two lists
                urls = __spreadArray([], new Set(urls), true);
                paths = __spreadArray([], new Set(paths), true);
                console.log(chalk_1.default.cyan("[i] Found ".concat(urls.length, " URLs and ").concat(paths.length, " paths")));
                return [4 /*yield*/, prettier_1.default.format(JSON.stringify({ urls: urls, paths: paths }), {
                        parser: "json",
                        printWidth: 80,
                        singleQuote: true,
                    })];
            case 2:
                formatted_urls = _l.sent();
                fs_1.default.writeFileSync("".concat(extracted_url_path, ".json"), formatted_urls);
                console.log(chalk_1.default.green("[\u2713] Written URLs and paths to ".concat(extracted_url_path, ".json")));
                if (!permutate_option) return [3 /*break*/, 4];
                return [4 /*yield*/, (0, permutate_js_1.default)(urls, paths, extracted_url_path)];
            case 3:
                _l.sent();
                _l.label = 4;
            case 4:
                if (!openapi_option) return [3 /*break*/, 6];
                return [4 /*yield*/, (0, openapi_js_1.default)(paths, extracted_url_path)];
            case 5:
                _l.sent();
                _l.label = 6;
            case 6:
                if (!scan_secrets) return [3 /*break*/, 11];
                console.log(chalk_1.default.cyan("[i] Scanning for secrets"));
                total_secrets = 0;
                _j = 0, js_files_path_2 = js_files_path;
                _l.label = 7;
            case 7:
                if (!(_j < js_files_path_2.length)) return [3 /*break*/, 10];
                file = js_files_path_2[_j];
                fileContent = fs_1.default.readFileSync(file, "utf8");
                return [4 /*yield*/, (0, secrets_js_1.default)(fileContent)];
            case 8:
                foundSecrets = _l.sent();
                if (foundSecrets.length > 0) {
                    for (_k = 0, foundSecrets_1 = foundSecrets; _k < foundSecrets_1.length; _k++) {
                        foundSecret = foundSecrets_1[_k];
                        console.log(chalk_1.default.green("[\u2713] Found ".concat(foundSecret.name, " in ").concat(file)));
                        console.log(chalk_1.default.bgGreen(foundSecret.value));
                        total_secrets++;
                    }
                }
                _l.label = 9;
            case 9:
                _j++;
                return [3 /*break*/, 7];
            case 10:
                if (total_secrets === 0) {
                    console.log(chalk_1.default.yellow("[!] No secrets found"));
                }
                else {
                    console.log(chalk_1.default.green("[\u2713] Found ".concat(total_secrets, " secrets")));
                }
                _l.label = 11;
            case 11: return [2 /*return*/];
        }
    });
}); };
exports.default = strings;
