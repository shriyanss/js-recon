"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var parser_1 = require("@babel/parser");
var traverse_1 = require("@babel/traverse");
var traverse = traverse_1.default.default;
var chalk_1 = require("chalk");
var fs_1 = require("fs");
var path_1 = require("path");
var getWebpacks = function (directory) {
    console.log(chalk_1.default.cyan("[i] Getting webpacks"));
    var webpacks = {};
    // get all files in the directory
    var files;
    files = fs_1.default.readdirSync(directory, { recursive: true });
    // filter out the directories
    files = files.filter(function (file) { return !fs_1.default.statSync(path_1.default.join(directory, file)).isDirectory(); });
    // filter out the subsequent requests files
    files = files.filter(function (file) { return !file.startsWith("___subsequent_requests"); });
    for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
        var file = files_1[_i];
        var code = fs_1.default.readFileSync(path_1.default.join(directory, file), "utf8");
        // parse the code with ast
        var ast = void 0;
        try {
            ast = parser_1.default.parse(code, {
                sourceType: "unambiguous",
                plugins: ["jsx", "typescript"],
            });
            // find all the function definition like 219038: function() {}
            traverse(ast, {
                FunctionDeclaration: function (path) {
                    var name = path.node.id.name;
                    var body = path.node.body;
                    // check if the function name is an integer
                    if (!isNaN(name)) {
                        webpacks[name] = body;
                    }
                },
            });
        }
        catch (err) {
            continue;
        }
    }
    return webpacks;
};
exports.default = getWebpacks;
