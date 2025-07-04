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
var fs_1 = require("fs");
var path_1 = require("path");
var traverse = traverse_1.default.default;
var resolveNodeValue = function (node, scope) {
    if (!node)
        return null;
    switch (node.type) {
        case "StringLiteral":
        case "NumericLiteral":
        case "BooleanLiteral":
            return node.value;
        case "NullLiteral":
            return null;
        case "TemplateLiteral":
            var result = "";
            for (var i = 0; i < node.quasis.length; i++) {
                result += node.quasis[i].value.raw;
                if (i < node.expressions.length) {
                    result += resolveNodeValue(node.expressions[i], scope);
                }
            }
            return result;
        case "Identifier": {
            var binding = scope.getBinding(node.name);
            if (binding && binding.path.node.init) {
                return resolveNodeValue(binding.path.node.init, scope);
            }
            return "[unresolved: ".concat(node.name, "]");
        }
        case "ObjectExpression": {
            var obj = {};
            for (var _i = 0, _a = node.properties; _i < _a.length; _i++) {
                var prop = _a[_i];
                if (prop.type === "ObjectProperty") {
                    var key = prop.computed
                        ? resolveNodeValue(prop.key, scope)
                        : prop.key.name || prop.key.value;
                    var value = resolveNodeValue(prop.value, scope);
                    obj[key] = value;
                }
                else if (prop.type === "SpreadElement") {
                    var spreadObj = resolveNodeValue(prop.argument, scope);
                    if (typeof spreadObj === "object" && spreadObj !== null) {
                        Object.assign(obj, spreadObj);
                    }
                }
            }
            return obj;
        }
        case "MemberExpression": {
            var object = resolveNodeValue(node.object, scope);
            if (typeof object === "object" && object !== null) {
                var propertyName = node.computed
                    ? resolveNodeValue(node.property, scope)
                    : node.property.name;
                return object[propertyName];
            }
            return "[unresolved member expression]";
        }
        case "CallExpression": {
            if (node.callee.type === "MemberExpression" &&
                node.callee.property.name === "toString") {
                return resolveNodeValue(node.callee.object, scope);
            }
            return "[unresolved call to ".concat(node.callee.name || "function", "]");
        }
        case "NewExpression": {
            if (node.callee.type === "Identifier" &&
                node.callee.name === "URL" &&
                node.arguments.length > 0) {
                return resolveNodeValue(node.arguments[0], scope);
            }
            return "[unresolved new expression]";
        }
        case "LogicalExpression": {
            var left = resolveNodeValue(node.left, scope);
            if (left && !String(left).startsWith("[")) {
                return left;
            }
            return resolveNodeValue(node.right, scope);
        }
        case "ConditionalExpression": {
            var consequent = resolveNodeValue(node.consequent, scope);
            if (consequent && !String(consequent).startsWith("[")) {
                return consequent;
            }
            return resolveNodeValue(node.alternate, scope);
        }
        case "BinaryExpression": {
            var left = resolveNodeValue(node.left, scope);
            var right = resolveNodeValue(node.right, scope);
            if (left !== null &&
                right !== null &&
                !String(left).startsWith("[") &&
                !String(right).startsWith("[")) {
                // eslint-disable-next-line default-case
                switch (node.operator) {
                    case "+":
                        return left + right;
                }
            }
            return "[unresolved binary expression: ".concat(node.operator, "]");
        }
        default:
            return "[unsupported node type: ".concat(node.type, "]");
    }
};
var resolveFetch = function (chunks, directory, formats) { return __awaiter(void 0, void 0, void 0, function () {
    var _loop_1, _i, _a, chunk;
    return __generator(this, function (_b) {
        console.log(chalk_1.default.cyan("[i] Resolving fetch instances"));
        _loop_1 = function (chunk) {
            if (!chunk.containsFetch || !chunk.file) {
                return "continue";
            }
            var filePath = path_1.default.join(directory, chunk.file);
            var fileContent = void 0;
            try {
                fileContent = fs_1.default.readFileSync(filePath, "utf-8");
            }
            catch (error) {
                console.log(chalk_1.default.red("[!] Could not read file: ".concat(filePath)));
                return "continue";
            }
            var fileAst = void 0;
            try {
                fileAst = parser_1.default.parse(fileContent, {
                    sourceType: "module",
                    plugins: ["jsx", "typescript"],
                    errorRecovery: true,
                });
            }
            catch (err) {
                console.log(chalk_1.default.red("[!] Failed to parse file: ".concat(filePath, ". Error: ").concat(err.message)));
                return "continue";
            }
            var fetchAliases = new Set();
            // Pass 1: Find fetch aliases on the full file AST
            traverse(fileAst, {
                VariableDeclarator: function (path) {
                    if (path.node.id.type === "Identifier" && path.node.init) {
                        if (path.node.init.type === "Identifier" &&
                            path.node.init.name === "fetch") {
                            var binding = path.scope.getBinding(path.node.id.name);
                            if (binding)
                                fetchAliases.add(binding);
                        }
                    }
                },
            });
            // Pass 2: Find and resolve fetch calls on the full file AST
            traverse(fileAst, {
                CallExpression: function (path) {
                    var isFetchCall = false;
                    var calleeName = path.node.callee.name;
                    if (calleeName === "fetch") {
                        isFetchCall = true;
                    }
                    else {
                        var binding = path.scope.getBinding(calleeName);
                        if (binding && fetchAliases.has(binding)) {
                            isFetchCall = true;
                        }
                    }
                    if (isFetchCall) {
                        console.log(chalk_1.default.blue("[+] Found fetch call in chunk ".concat(chunk.id, " (").concat(chunk.file, ") at L").concat(path.node.loc.start.line)));
                        var args = path.node.arguments;
                        if (args.length > 0) {
                            var url = resolveNodeValue(args[0], path.scope);
                            console.log(chalk_1.default.green("    URL: ".concat(url)));
                            if (args.length > 1) {
                                var options = resolveNodeValue(args[1], path.scope);
                                if (typeof options === "object" &&
                                    options !== null) {
                                    console.log(chalk_1.default.green("    Method: ".concat(options.method || "GET")));
                                    if (options.headers)
                                        console.log(chalk_1.default.green("    Headers: ".concat(JSON.stringify(options.headers))));
                                    if (options.body)
                                        console.log(chalk_1.default.green("    Body: ".concat(JSON.stringify(options.body))));
                                }
                                else {
                                    console.log(chalk_1.default.yellow("    Options: ".concat(options)));
                                }
                            }
                        }
                    }
                },
            });
        };
        for (_i = 0, _a = Object.values(chunks); _i < _a.length; _i++) {
            chunk = _a[_i];
            _loop_1(chunk);
        }
        return [2 /*return*/];
    });
}); };
exports.default = resolveFetch;
