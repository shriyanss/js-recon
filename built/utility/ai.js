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
exports.ollama_client = exports.openai_client = exports.ai = void 0;
exports.getCompletion = getCompletion;
var openai_1 = require("openai");
var ollama_1 = require("ollama");
var globals = require("./globals.js");
var openai_client = new openai_1.default({
    baseURL: globals.getAiEndpoint() || "https://api.openai.com/v1",
    apiKey: globals.getOpenaiApiKey(),
});
exports.openai_client = openai_client;
var ollama_client = new ollama_1.Ollama({
    host: globals.getAiEndpoint() || "http://127.0.0.1:11434",
});
exports.ollama_client = ollama_client;
var ai = function () { return __awaiter(void 0, void 0, void 0, function () {
    var returnVal, provider;
    return __generator(this, function (_a) {
        returnVal = { client: undefined, model: globals.getAiModel() };
        provider = globals.getAiServiceProvider();
        if (provider === "openai") {
            returnVal.client = openai_client;
        }
        else if (provider === "ollama") {
            returnVal.client = ollama_client;
        }
        return [2 /*return*/, returnVal];
    });
}); };
exports.ai = ai;
function getCompletion(prompt_1) {
    return __awaiter(this, arguments, void 0, function (prompt, systemPrompt) {
        var _a, client, model, provider, completion, response;
        var _b, _c, _d, _e;
        if (systemPrompt === void 0) { systemPrompt = "You are a helpful assistant."; }
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0: return [4 /*yield*/, ai()];
                case 1:
                    _a = _f.sent(), client = _a.client, model = _a.model;
                    provider = globals.getAiServiceProvider();
                    if (!client) {
                        throw new Error("AI service provider \"".concat(provider, "\" is not supported or configured."));
                    }
                    if (!(provider === "openai")) return [3 /*break*/, 3];
                    return [4 /*yield*/, client.responses.create({
                            input: [
                                { role: "system", content: systemPrompt },
                                { role: "user", content: prompt },
                            ],
                            model: model || "gpt-4o-mini",
                            temperature: 0.1,
                        })];
                case 2:
                    completion = _f.sent();
                    return [2 /*return*/, ((_e = (_d = (_c = (_b = completion === null || completion === void 0 ? void 0 : completion.output) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.content) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text) || "none"];
                case 3:
                    if (!(provider === "ollama")) return [3 /*break*/, 5];
                    return [4 /*yield*/, ollama_client.chat({
                            model: model || "llama3.1",
                            messages: [
                                { role: "system", content: systemPrompt },
                                {
                                    role: "user",
                                    content: prompt,
                                },
                            ],
                            options: {
                                temperature: 0.1,
                            },
                        })];
                case 4:
                    response = _f.sent();
                    return [2 /*return*/, response.message.content || "none"];
                case 5: return [2 /*return*/];
            }
        });
    });
}
