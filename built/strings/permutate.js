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
var permutate = function (urls, paths, output) { return __awaiter(void 0, void 0, void 0, function () {
    var permutedUrls, _i, urls_1, url, baseUrl, _a, paths_1, path, _b, urls_2, url, results;
    return __generator(this, function (_c) {
        console.log(chalk_1.default.cyan("[i] Permutating URLs and paths"));
        permutedUrls = [];
        //   go through each URL
        for (_i = 0, urls_1 = urls; _i < urls_1.length; _i++) {
            url = urls_1[_i];
            // check if the URL is valid or not by passing to URL
            try {
                new URL(url);
            }
            catch (err) {
                continue;
            }
            baseUrl = new URL(url).origin;
            // go through each path
            for (_a = 0, paths_1 = paths; _a < paths_1.length; _a++) {
                path = paths_1[_a];
                // join the baseurl and the path, and push it to an array
                permutedUrls.push(new URL(path, baseUrl).href);
            }
        }
        // append all the urls also
        permutedUrls.push.apply(permutedUrls, urls);
        // get the origin aka baseurl, and push those also
        for (_b = 0, urls_2 = urls; _b < urls_2.length; _b++) {
            url = urls_2[_b];
            try {
                permutedUrls.push(new URL(url).origin);
            }
            catch (_d) { }
        }
        // deduplicate
        permutedUrls = __spreadArray([], new Set(permutedUrls), true);
        results = permutedUrls.join("\n");
        fs_1.default.writeFileSync("".concat(output, ".txt"), results);
        console.log(chalk_1.default.green("[\u2713] Written permuted URLs to ".concat(output, ".txt")));
        return [2 /*return*/];
    });
}); };
exports.default = permutate;
