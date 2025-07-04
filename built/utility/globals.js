"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTech = exports.setTech = exports.tech = exports.getAiEndpoint = exports.setAiEndpoint = exports.getAiServiceProvider = exports.setAiServiceProvider = exports.getAiThreads = exports.setAiThreads = exports.setAiModel = exports.getAiModel = exports.getOpenaiApiKey = exports.getAi = exports.setOpenaiApiKey = exports.setAi = exports.aiEndpoint = exports.aiThreads = exports.aiServiceProvider = exports.aiModel = exports.openaiApiKey = exports.ai = exports.getYes = exports.setYes = exports.yes = exports.getRespCacheFile = exports.getDisableCache = exports.setRespCacheFile = exports.setDisableCache = exports.respCacheFile = exports.disableCache = exports.setUseApiGateway = exports.setApiGatewayConfigFile = exports.useApiGateway = exports.apiGatewayConfigFile = void 0;
// api gateway
exports.apiGatewayConfigFile = "";
exports.useApiGateway = false;
var setApiGatewayConfigFile = function (file) {
    exports.apiGatewayConfigFile = file;
};
exports.setApiGatewayConfigFile = setApiGatewayConfigFile;
var setUseApiGateway = function (value) {
    exports.useApiGateway = value;
};
exports.setUseApiGateway = setUseApiGateway;
// response cache
exports.disableCache = false;
exports.respCacheFile = ".resp_cache.json";
var setDisableCache = function (value) {
    exports.disableCache = value;
};
exports.setDisableCache = setDisableCache;
var setRespCacheFile = function (file) {
    exports.respCacheFile = file;
};
exports.setRespCacheFile = setRespCacheFile;
var getDisableCache = function () {
    return exports.disableCache;
};
exports.getDisableCache = getDisableCache;
var getRespCacheFile = function () {
    return exports.respCacheFile;
};
exports.getRespCacheFile = getRespCacheFile;
// auto execute code
exports.yes = false;
var setYes = function (value) {
    exports.yes = value;
};
exports.setYes = setYes;
var getYes = function () {
    return exports.yes;
};
exports.getYes = getYes;
// AI
exports.ai = undefined;
exports.openaiApiKey = undefined;
exports.aiModel = "gpt-4o-mini";
exports.aiServiceProvider = "openai";
exports.aiThreads = 5;
exports.aiEndpoint = undefined;
var setAi = function (value) {
    exports.ai = value;
};
exports.setAi = setAi;
var setOpenaiApiKey = function (value) {
    exports.openaiApiKey = value;
};
exports.setOpenaiApiKey = setOpenaiApiKey;
var getAi = function () {
    return exports.ai;
};
exports.getAi = getAi;
var getOpenaiApiKey = function () {
    return exports.openaiApiKey;
};
exports.getOpenaiApiKey = getOpenaiApiKey;
var getAiModel = function () {
    return exports.aiModel;
};
exports.getAiModel = getAiModel;
var setAiModel = function (value) {
    exports.aiModel = value;
};
exports.setAiModel = setAiModel;
var setAiThreads = function (value) {
    exports.aiThreads = value;
};
exports.setAiThreads = setAiThreads;
var getAiThreads = function () {
    return exports.aiThreads;
};
exports.getAiThreads = getAiThreads;
var setAiServiceProvider = function (value) {
    exports.aiServiceProvider = value;
};
exports.setAiServiceProvider = setAiServiceProvider;
var getAiServiceProvider = function () {
    return exports.aiServiceProvider;
};
exports.getAiServiceProvider = getAiServiceProvider;
var setAiEndpoint = function (value) {
    exports.aiEndpoint = value;
};
exports.setAiEndpoint = setAiEndpoint;
var getAiEndpoint = function () {
    return exports.aiEndpoint;
};
exports.getAiEndpoint = getAiEndpoint;
// tech
exports.tech = undefined;
var setTech = function (value) {
    exports.tech = value;
};
exports.setTech = setTech;
var getTech = function () {
    return exports.tech;
};
exports.getTech = getTech;
