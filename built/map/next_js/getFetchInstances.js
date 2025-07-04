"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var traverse_1 = require("@babel/traverse");
var traverse = traverse_1.default.default;
var parser_1 = require("@babel/parser");
var isFetchIdentifier = function (node) {
    return node.type === "Identifier" && node.name === "fetch";
};
var isFetchFallback = function (node) {
    // x ?? fetch      OR     cond ? x : fetch
    return ((node.type === "LogicalExpression" &&
        node.right &&
        isFetchIdentifier(node.right)) ||
        (node.type === "ConditionalExpression" &&
            isFetchIdentifier(node.alternate)));
};
var getFetchInstances = function (chunks, output, formats) { return __awaiter(void 0, void 0, void 0, function () {
    var chunk_copy, _loop_1, _i, _a, chunk, chunks_json;
    return __generator(this, function (_b) {
        console.log(chalk_1.default.cyan("[i] Running 'getFetchInstances' module"));
        chunk_copy = __assign({}, chunks);
        _loop_1 = function (chunk) {
            var chunkAst = parser_1.default.parse(chunk.code, {
                sourceType: "module",
                plugins: ["jsx", "typescript"],
            });
            var fetchAliases = new Set();
            var fetchCalls = new Set();
            traverse(chunkAst, {
                // -------- Pass 1:  look for aliases --------
                //  a)  const S = fetch;
                //  b)  const S = something ?? fetch;
                //  c)  const S = cond ? x : fetch;
                VariableDeclarator: function (path) {
                    var _a = path.node, id = _a.id, init = _a.init;
                    if (id.type !== "Identifier" || !init)
                        return;
                    var aliasName = id.name;
                    if (isFetchIdentifier(init) || isFetchFallback(init)) {
                        // Record the binding *object* so we can track its references later
                        var binding = path.scope.getBinding(aliasName);
                        if (binding) {
                            fetchAliases.add(binding);
                        }
                    }
                },
                AssignmentExpression: function (path) {
                    // Handles re-assignment:   S = fetch;
                    var _a = path.node, left = _a.left, right = _a.right;
                    if (left.type !== "Identifier")
                        return;
                    if (isFetchIdentifier(right) || isFetchFallback(right)) {
                        var binding = path.scope.getBinding(left.name);
                        if (binding) {
                            fetchAliases.add(binding);
                        }
                    }
                },
                CallExpression: function (path) {
                    if (isFetchIdentifier(path.node.callee)) {
                        var _a = path.node.callee.loc.start, line = _a.line, column = _a.column;
                        fetchCalls.add({
                            line: line,
                            column: column,
                        });
                    }
                },
            });
            // -------- Pass 2:  report the call-sites (aliases) --------
            for (var _c = 0, fetchAliases_1 = fetchAliases; _c < fetchAliases_1.length; _c++) {
                var binding = fetchAliases_1[_c];
                binding.referencePaths.forEach(function (ref) {
                    var parent = ref.parent;
                    if (parent.type === "CallExpression" &&
                        parent.callee === ref.node) {
                        var _a = ref.node.loc.start, line = _a.line, column = _a.column;
                        console.log(chalk_1.default.magenta("[fetch] Webpack ID ".concat(chunk.id, ": fetch() alias '").concat(ref.node.name, "' called at ").concat(line, ":").concat(column)));
                    }
                });
            }
            // -------- Pass 3:  report the call-sites (direct) --------
            for (var _d = 0, fetchCalls_1 = fetchCalls; _d < fetchCalls_1.length; _d++) {
                var call = fetchCalls_1[_d];
                console.log(chalk_1.default.magenta("[fetch] Webpack ID ".concat(chunk.id, ": fetch() called at ").concat(call.line, ":").concat(call.column)));
            }
            // if the length of either of the sets is non-zero, then mark the chunk as containing fetch
            if (fetchAliases.size > 0 || fetchCalls.size > 0) {
                chunk_copy[chunk.id].containsFetch = true;
            }
        };
        //   iterate through the chunks, and check fetch instances
        for (_i = 0, _a = Object.values(chunks); _i < _a.length; _i++) {
            chunk = _a[_i];
            _loop_1(chunk);
        }
        if (formats.includes("json")) {
            chunks_json = JSON.stringify(chunks, null, 2);
            fs_1.default.writeFileSync("".concat(output, ".json"), chunks_json);
            console.log(chalk_1.default.green("[\u2713] Saved webpack with fetch instances to ".concat(output, ".json")));
        }
        return [2 /*return*/, chunk_copy];
    });
}); };
exports.default = getFetchInstances;
