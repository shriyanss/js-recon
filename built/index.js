#!/usr/bin/env node
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
var commander_1 = require("commander");
var index_js_1 = require("./lazyLoad/index.js");
var index_js_2 = require("./endpoints/index.js");
var globalConfig_js_1 = require("./globalConfig.js");
var index_js_3 = require("./strings/index.js");
var index_js_4 = require("./api_gateway/index.js");
var index_js_5 = require("./map/index.js");
var globals = require("./utility/globals.js");
var index_js_6 = require("./run/index.js");
var chalk_1 = require("chalk");
commander_1.program.version(globalConfig_js_1.default.version).description(globalConfig_js_1.default.toolDesc);
var validAiOptions = ["description"];
commander_1.program
    .command("lazyload")
    .description("Run lazy load module")
    .requiredOption("-u, --url <url/file>", "Target URL or a file containing a list of URLs (one per line)")
    .option("-o, --output <directory>", "Output directory", "output")
    .option("--strict-scope", "Download JS files from only the input URL domain", false)
    .option("-s, --scope <scope>", "Download JS files from specific domains (comma-separated)", "*")
    .option("-t, --threads <threads>", "Number of threads to use", 1)
    .option("--subsequent-requests", "Download JS files from subsequent requests (Next.JS only)", false)
    .option("--urls-file <file>", "Input JSON file containing URLs", "extracted_urls.json")
    .option("--api-gateway", "Generate requests using API Gateway", false)
    .option("--api-gateway-config <file>", "API Gateway config file", ".api_gateway_config.json")
    .option("--cache-file <file>", "File to contain response cache", ".resp_cache.json")
    .option("--disable-cache", "Disable response caching", false)
    .option("-y, --yes", "Auto-approve executing JS code from the target", false)
    .action(function (cmd) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                globals.setApiGatewayConfigFile(cmd.apiGatewayConfig);
                globals.setUseApiGateway(cmd.apiGateway);
                globals.setDisableCache(cmd.disableCache);
                globals.setRespCacheFile(cmd.cacheFile);
                globals.setYes(cmd.yes);
                return [4 /*yield*/, (0, index_js_1.default)(cmd.url, cmd.output, cmd.strictScope, cmd.scope.split(","), cmd.threads, cmd.subsequentRequests, cmd.urlsFile)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
commander_1.program
    .command("endpoints")
    .description("Extract API endpoints")
    .option("-u, --url <url>", "Target Base URL (will be used to resolve relative paths)")
    .option("-d, --directory <directory>", "Directory containing JS files")
    .option("-o, --output <filename>", "Output filename (without file extension)", "endpoints")
    .option("--output-format <format>", "Output format for the results comma-separated (available: json, md)", "json")
    .option("-t, --tech <tech>", "Technology used in the JS files (run with -l/--list to see available options)")
    .option("-l, --list", "List available technologies", false)
    .option("--subsequent-requests-dir <directory>", "Directory containing subsequent requests (for Next.JS)")
    .action(function (cmd) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, index_js_2.default)(cmd.url, cmd.directory, cmd.output, cmd.outputFormat.split(","), cmd.tech, cmd.list, cmd.subsequentRequestsDir)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
commander_1.program
    .command("strings")
    .description("Extract strings from JS files")
    .requiredOption("-d, --directory <directory>", "Directory containing JS files")
    .option("-o, --output <file>", "JSON file to save the strings", "strings.json")
    .option("-e, --extract-urls", "Extract URLs from strings", false)
    .option("--extracted-url-path <file>", "Output file for extracted URLs and paths (without extension)", "extracted_urls")
    .option("-p, --permutate", "Permutate URLs and paths found", false)
    .option("--openapi", "Generate OpenAPI specification from the paths found", false)
    .option("-s, --scan-secrets", "Scan for secrets", false)
    .action(function (cmd) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, index_js_3.default)(cmd.directory, cmd.output, cmd.extractUrls, cmd.extractedUrlPath, cmd.scanSecrets, cmd.permutate, cmd.openapi)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
commander_1.program
    .command("api-gateway")
    .description("Configure AWS API Gateway to rotate IP addresses")
    .option("-i, --init", "Initialize the config file (create API)", false)
    .option("-d, --destroy <id>", "Destroy API with the given ID")
    .option("--destroy-all", "Destroy all the API created by this tool in all regions", false)
    .option("-r, --region <region>", "AWS region (default: random region)")
    .option("-a, --access-key <access-key>", "AWS access key (if not provided, AWS_ACCESS_KEY_ID environment variable will be used)")
    .option("-s, --secret-key <secret-key>", "AWS secret key (if not provided, AWS_SECRET_ACCESS_KEY environment variable will be used)")
    .option("-c, --config <config>", "Name of the config file", ".api_gateway_config.json")
    .option("-l, --list", "List all the API created by this tool", false)
    .option("--feasibility", "Check feasibility of API Gateway", false)
    .option("--feasibility-url <url>", "URL to check feasibility of")
    .action(function (cmd) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                globals.setApiGatewayConfigFile(cmd.config);
                globals.setUseApiGateway(true);
                return [4 /*yield*/, (0, index_js_4.default)(cmd.init, cmd.destroy, cmd.destroyAll, cmd.list, cmd.region, cmd.accessKey, cmd.secretKey, cmd.config, cmd.feasibility, cmd.feasibilityUrl)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
commander_1.program
    .command("map")
    .description("Map all the functions")
    .option("-d, --directory <directory>", "Directory containing JS files")
    .option("-t, --tech <tech>", "Technology used in the JS files (run with -l/--list to see available options)")
    .option("-l, --list", "List available technologies", false)
    .option("-o, --output <file>", "Output file name (without extension)", "mapped")
    .option("-f, --format <format>", "Output format for the results comma-separated (available: JSON)", "json")
    .option("-i, --interactive", "Interactive mode", false)
    .option("--ai <options>", "Use AI to analyze the code (comma-separated; available: description)")
    .option("--ai-threads <threads>", "Number of threads to use for AI", 5)
    .option("--ai-provider <provider>", "Service provider to use for AI (available: openai, ollama)", "openai")
    .option("--ai-endpoint <endpoint>", "Endpoint to use for AI service (for Ollama, etc)")
    .option("--openai-api-key <key>", "OpenAI API key")
    .option("--model <model>", "AI model to use", "gpt-4o-mini")
    .action(function (cmd) { return __awaiter(void 0, void 0, void 0, function () {
    var _i, _a, aiType;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                globals.setAi(((_b = cmd.ai) === null || _b === void 0 ? void 0 : _b.split(",")) || []);
                globals.setAiServiceProvider(cmd.aiProvider);
                globals.setOpenaiApiKey(cmd.openaiApiKey);
                globals.setAiModel(cmd.model);
                if (cmd.aiEndpoint)
                    globals.setAiEndpoint(cmd.aiEndpoint);
                globals.setAiThreads(cmd.aiThreads);
                // validate AI options
                if (globals.getAi() != []) {
                    for (_i = 0, _a = globals.getAi(); _i < _a.length; _i++) {
                        aiType = _a[_i];
                        if (aiType !== "" && !validAiOptions.includes(aiType)) {
                            console.log(chalk_1.default.red("[!] Invalid AI option: ".concat(aiType)));
                            return [2 /*return*/];
                        }
                    }
                }
                return [4 /*yield*/, (0, index_js_5.default)(cmd.directory, cmd.output, cmd.format.split(","), cmd.tech, cmd.list, cmd.interactive)];
            case 1:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
commander_1.program
    .command("run")
    .description("Run all modules")
    .requiredOption("-u, --url <url/file>", "Target URL or a file containing a list of URLs (one per line)")
    .option("-o, --output <directory>", "Output directory", "output")
    .option("--strict-scope", "Download JS files from only the input URL domain", false)
    .option("-s, --scope <scope>", "Download JS files from specific domains (comma-separated)", "*")
    .option("-t, --threads <threads>", "Number of threads to use", 1)
    .option("--api-gateway", "Generate requests using API Gateway", false)
    .option("--api-gateway-config <file>", "API Gateway config file", ".api_gateway_config.json")
    .option("--cache-file <file>", "File to contain response cache", ".resp_cache.json")
    .option("--disable-cache", "Disable response caching", false)
    .option("-y, --yes", "Auto-approve executing JS code from the target", false)
    .option("--secrets", "Scan for secrets", false)
    .option("--ai <options>", "Use AI to analyze the code (comma-separated; available: description)")
    .option("--ai-threads <threads>", "Number of threads to use for AI", 5)
    .option("--ai-provider <provider>", "Service provider to use for AI (available: openai, ollama)", "openai")
    .option("--ai-endpoint <endpoint>", "Endpoint to use for AI service (for Ollama, etc)")
    .option("--openai-api-key <key>", "OpenAI API key")
    .option("--model <model>", "AI model to use", "gpt-4o-mini")
    .action(function (cmd) { return __awaiter(void 0, void 0, void 0, function () {
    var _i, _a, aiType;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                globals.setAi(((_b = cmd.ai) === null || _b === void 0 ? void 0 : _b.split(",")) || []);
                globals.setOpenaiApiKey(cmd.openaiApiKey);
                globals.setAiModel(cmd.model);
                globals.setAiServiceProvider(cmd.aiProvider);
                globals.setAiThreads(cmd.aiThreads);
                if (cmd.aiEndpoint)
                    globals.setAiEndpoint(cmd.aiEndpoint);
                // validate AI options
                if (globals.getAi() != []) {
                    for (_i = 0, _a = globals.getAi(); _i < _a.length; _i++) {
                        aiType = _a[_i];
                        if (aiType !== "" && !validAiOptions.includes(aiType)) {
                            console.log(chalk_1.default.red("[!] Invalid AI option: ".concat(aiType)));
                            return [2 /*return*/];
                        }
                    }
                }
                return [4 /*yield*/, (0, index_js_6.default)(cmd)];
            case 1:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
commander_1.program.parse(process.argv);
