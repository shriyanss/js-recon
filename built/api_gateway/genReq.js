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
exports.get = void 0;
var client_api_gateway_1 = require("@aws-sdk/client-api-gateway");
var fs_1 = require("fs");
var md5_1 = require("md5");
var chalk_1 = require("chalk");
var globals = require("../utility/globals.js");
var checkFireWallBlocking_js_1 = require("./checkFireWallBlocking.js");
var sleep = function (ms) { return new Promise(function (resolve) { return setTimeout(resolve, ms); }); };
/**
 * Given a URL, generates a new API Gateway for it and returns the response of the URL.
 * @param {string} url The URL to generate an API Gateway for.
 * @param {object} [headers] The headers to include in the request.
 * @returns {Promise<string>} The response of the URL.
 */
var get = function (url, headers) { return __awaiter(void 0, void 0, void 0, function () {
    var config, apiGateway, client, getResourceCommand, getResourceResponse, resourceExists, newResourceResponse, rootId, newResourceCommand, newMethodCommand, newMethodResponse, newIntegrationCommand, newIntegrationResponse, newMethodResponseCommand, newMethodResponseResponse, putIntegrationResponseCommand, putIntegrationResponseResponse, testInvokeMethodQuery, testInvokeMethodResponse, body, isFireWallBlocking, deleteResourceCommand, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                config = JSON.parse(fs_1.default.readFileSync(globals.apiGatewayConfigFile));
                apiGateway = Object.keys(config)[Math.floor(Math.random() * Object.keys(config).length)];
                client = new client_api_gateway_1.APIGatewayClient({
                    region: config[apiGateway].region,
                    credentials: {
                        accessKeyId: config[apiGateway].access_key,
                        secretAccessKey: config[apiGateway].secret_key,
                    },
                });
                getResourceCommand = new client_api_gateway_1.GetResourcesCommand({
                    restApiId: config[apiGateway].id,
                    limit: 999999999,
                });
                return [4 /*yield*/, client.send(getResourceCommand)];
            case 1:
                getResourceResponse = _b.sent();
                return [4 /*yield*/, sleep(200)];
            case 2:
                _b.sent();
                resourceExists = getResourceResponse.items.find(
                // file deepcode ignore InsecureHash: False positive
                function (item) { return item.pathPart === (0, md5_1.default)(url); });
                if (!resourceExists) return [3 /*break*/, 3];
                // console.log(chalk.yellow("[!] Resource already exists"));
                newResourceResponse = {
                    id: resourceExists.id,
                };
                return [3 /*break*/, 14];
            case 3:
                rootId = void 0;
                if (getResourceResponse.items.find(function (item) { return item.path === "/"; })) {
                    rootId = getResourceResponse.items.find(function (item) { return item.path === "/"; }).id;
                }
                else {
                    rootId = getResourceResponse.items[0].parentId;
                }
                newResourceCommand = new client_api_gateway_1.CreateResourceCommand({
                    restApiId: config[apiGateway].id,
                    parentId: rootId,
                    pathPart: (0, md5_1.default)(url), // md5 of the url
                });
                return [4 /*yield*/, client.send(newResourceCommand)];
            case 4:
                newResourceResponse = _b.sent();
                return [4 /*yield*/, sleep(200)];
            case 5:
                _b.sent();
                newMethodCommand = new client_api_gateway_1.PutMethodCommand({
                    restApiId: config[apiGateway].id,
                    resourceId: newResourceResponse.id,
                    httpMethod: "GET",
                    authorizationType: "NONE",
                    requestParameters: {
                        "method.request.header.RSC": false,
                        "method.request.header.User-Agent": false,
                        "method.request.header.Referer": false,
                        "method.request.header.Accept": false,
                        "method.request.header.Accept-Language": false,
                        "method.request.header.Accept-Encoding": false,
                        "method.request.header.Content-Type": false,
                        "method.request.header.Content-Length": false,
                        "method.request.header.Origin": false,
                        "method.request.header.X-Forwarded-For": false,
                        "method.request.header.X-Forwarded-Host": false,
                        "method.request.header.X-IP": false,
                        "method.request.header.X-Forwarded-Proto": false,
                        "method.request.header.X-Forwarded-Port": false,
                        "method.request.header.Sec-Fetch-Site": false,
                        "method.request.header.Sec-Fetch-Mode": false,
                        "method.request.header.Sec-Fetch-Dest": false,
                    },
                    integrationHttpMethod: "GET",
                    type: "HTTP",
                    timeoutInMillis: 29000,
                });
                return [4 /*yield*/, client.send(newMethodCommand)];
            case 6:
                newMethodResponse = _b.sent();
                return [4 /*yield*/, sleep(100)];
            case 7:
                _b.sent();
                newIntegrationCommand = new client_api_gateway_1.PutIntegrationCommand({
                    restApiId: config[apiGateway].id,
                    resourceId: newResourceResponse.id,
                    httpMethod: "GET",
                    integrationHttpMethod: "GET",
                    type: "HTTP",
                    timeoutInMillis: 29000,
                    uri: url,
                });
                return [4 /*yield*/, client.send(newIntegrationCommand)];
            case 8:
                newIntegrationResponse = _b.sent();
                return [4 /*yield*/, sleep(100)];
            case 9:
                _b.sent();
                newMethodResponseCommand = new client_api_gateway_1.PutMethodResponseCommand({
                    httpMethod: "GET",
                    resourceId: newResourceResponse.id,
                    restApiId: config[apiGateway].id,
                    statusCode: "200",
                });
                return [4 /*yield*/, client.send(newMethodResponseCommand)];
            case 10:
                newMethodResponseResponse = _b.sent();
                return [4 /*yield*/, sleep(100)];
            case 11:
                _b.sent();
                putIntegrationResponseCommand = new client_api_gateway_1.PutIntegrationResponseCommand({
                    httpMethod: "GET",
                    resourceId: newResourceResponse.id,
                    restApiId: config[apiGateway].id,
                    statusCode: "200",
                });
                return [4 /*yield*/, client.send(putIntegrationResponseCommand)];
            case 12:
                putIntegrationResponseResponse = _b.sent();
                return [4 /*yield*/, sleep(100)];
            case 13:
                _b.sent();
                _b.label = 14;
            case 14:
                testInvokeMethodQuery = new client_api_gateway_1.TestInvokeMethodCommand({
                    httpMethod: "GET",
                    resourceId: newResourceResponse.id,
                    restApiId: config[apiGateway].id,
                    headers: headers || {},
                });
                return [4 /*yield*/, client.send(testInvokeMethodQuery)];
            case 15:
                testInvokeMethodResponse = _b.sent();
                return [4 /*yield*/, sleep(100)];
            case 16:
                _b.sent();
                return [4 /*yield*/, testInvokeMethodResponse.body];
            case 17:
                body = _b.sent();
                return [4 /*yield*/, (0, checkFireWallBlocking_js_1.default)(body)];
            case 18:
                isFireWallBlocking = _b.sent();
                deleteResourceCommand = new client_api_gateway_1.DeleteResourceCommand({
                    restApiId: config[apiGateway].id,
                    resourceId: newResourceResponse.id,
                });
                _b.label = 19;
            case 19:
                _b.trys.push([19, 21, , 22]);
                return [4 /*yield*/, client.send(deleteResourceCommand)];
            case 20:
                _b.sent();
                return [3 /*break*/, 22];
            case 21:
                _a = _b.sent();
                return [3 /*break*/, 22];
            case 22:
                if (isFireWallBlocking) {
                    console.log(chalk_1.default.magenta("[!] Please try again without API Gateway"));
                    process.exit(1);
                }
                return [2 /*return*/, body];
        }
    });
}); };
exports.get = get;
