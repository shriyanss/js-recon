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
var client_api_gateway_1 = require("@aws-sdk/client-api-gateway");
var fs_1 = require("fs");
var checkFeasibility_js_1 = require("./checkFeasibility.js");
// read the docs for all the methods for api gateway at https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/api-gateway/
// for the rate limits, refer to https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html
var randomRegion = function () {
    var apiGatewayRegions = [
        "us-east-2", // US East (Ohio)
        "us-east-1", // US East (N. Virginia)
        "us-west-1", // US West (N. California)
        "us-west-2", // US West (Oregon)
        "af-south-1", // Africa (Cape Town)
        "ap-east-1", // Asia Pacific (Hong Kong)
        "ap-south-2", // Asia Pacific (Hyderabad)
        "ap-southeast-3", // Asia Pacific (Jakarta)
        "ap-southeast-5", // Asia Pacific (Malaysia)
        "ap-southeast-4", // Asia Pacific (Melbourne)
        "ap-south-1", // Asia Pacific (Mumbai)
        "ap-northeast-3", // Asia Pacific (Osaka)
        "ap-northeast-2", // Asia Pacific (Seoul)
        "ap-southeast-1", // Asia Pacific (Singapore)
        "ap-southeast-2", // Asia Pacific (Sydney)
        "ap-east-2", // Asia Pacific (Taipei)
        "ap-southeast-7", // Asia Pacific (Thailand)
        "ap-northeast-1", // Asia Pacific (Tokyo)
        "ca-central-1", // Canada (Central)
        "ca-west-1", // Canada West (Calgary)
        "eu-central-1", // Europe (Frankfurt)
        "eu-west-1", // Europe (Ireland)
        "eu-west-2", // Europe (London)
        "eu-south-1", // Europe (Milan)
        "eu-west-3", // Europe (Paris)
        "eu-south-2", // Europe (Spain)
        "eu-north-1", // Europe (Stockholm)
        "eu-central-2", // Europe (Zurich)
        "il-central-1", // Israel (Tel Aviv)
        "mx-central-1", // Mexico (Central)
        "me-south-1", // Middle East (Bahrain)
        "me-central-1", // Middle East (UAE)
        "sa-east-1", // South America (São Paulo)
    ];
    return apiGatewayRegions[Math.floor(Math.random() * apiGatewayRegions.length)];
};
var aws_access_key;
var aws_secret_key;
var region;
var configFile;
var sleep = function (ms) { return new Promise(function (resolve) { return setTimeout(resolve, ms); }); };
/**
 * Create a new API Gateway.
 *
 * @async
 * @returns {Promise<void>}
 */
var createGateway = function () { return __awaiter(void 0, void 0, void 0, function () {
    var client, apigw_created_at, apigw_name, command, response, config;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log(chalk_1.default.cyan("[i] Creating API Gateway"));
                client = new client_api_gateway_1.APIGatewayClient({
                    region: region,
                    credentials: {
                        accessKeyId: aws_access_key,
                        secretAccessKey: aws_secret_key,
                    },
                });
                apigw_created_at = Date.now();
                apigw_name = "js_recon-".concat(apigw_created_at, "-").concat(Math.floor(Math.random() * 1000));
                command = new client_api_gateway_1.CreateRestApiCommand({
                    name: apigw_name,
                    description: "API Gateway for JS Recon created at ".concat(new Intl.DateTimeFormat("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        timeZoneName: "short",
                    }).format(apigw_created_at)),
                    endpointConfiguration: {
                        ipAddressType: "dualstack",
                        types: ["REGIONAL"],
                    },
                });
                return [4 /*yield*/, client.send(command)];
            case 1:
                response = _a.sent();
                return [4 /*yield*/, sleep(3000)];
            case 2:
                _a.sent();
                console.log(chalk_1.default.green("[\u2713] Created API Gateway"));
                console.log(chalk_1.default.bgGreen("ID:"), chalk_1.default.green(response.id));
                console.log(chalk_1.default.bgGreen("Name:"), chalk_1.default.green(apigw_name));
                console.log(chalk_1.default.bgGreen("Region:"), chalk_1.default.green(region));
                config = {};
                try {
                    config = JSON.parse(fs_1.default.readFileSync(configFile));
                }
                catch (e) {
                    config = {};
                }
                config[apigw_name] = {
                    id: response.id,
                    name: apigw_name,
                    description: response.description,
                    created_at: apigw_created_at,
                    region: region,
                    access_key: aws_access_key,
                    secret_key: aws_secret_key,
                };
                fs_1.default.writeFileSync(configFile, JSON.stringify(config, null, 2));
                console.log(chalk_1.default.green("[\u2713] Config saved to ".concat(configFile)));
                return [2 /*return*/];
        }
    });
}); };
/**
 * Destroy an API Gateway.
 *
 * @async
 * @param {string} id - The ID of the API Gateway to destroy.
 * @returns {Promise<void>}
 */
var destroyGateway = function (id) { return __awaiter(void 0, void 0, void 0, function () {
    var config, name, client, command;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log(chalk_1.default.cyan("[i] Destroying API Gateway"));
                if (!id) {
                    console.log(chalk_1.default.red("[!] Please provide an API Gateway ID"));
                    return [2 /*return*/];
                }
                config = JSON.parse(fs_1.default.readFileSync(configFile));
                name = Object.keys(config).find(function (key) { return config[key].id === id; });
                console.log(chalk_1.default.bgGreen("Name:"), chalk_1.default.green(name));
                console.log(chalk_1.default.bgGreen("ID:"), chalk_1.default.green(id));
                console.log(chalk_1.default.bgGreen("Region:"), chalk_1.default.green(config[name].region));
                region = config[name].region;
                client = new client_api_gateway_1.APIGatewayClient({
                    region: region,
                    credentials: {
                        accessKeyId: aws_access_key,
                        secretAccessKey: aws_secret_key,
                    },
                });
                command = new client_api_gateway_1.DeleteRestApiCommand({
                    restApiId: id,
                });
                return [4 /*yield*/, client.send(command)];
            case 1:
                _a.sent();
                // remove from the config file
                delete config[name];
                fs_1.default.writeFileSync(configFile, JSON.stringify(config, null, 2));
                return [4 /*yield*/, sleep(30000)];
            case 2:
                _a.sent();
                console.log(chalk_1.default.green("[\u2713] Destroyed API Gateway: ".concat(id)));
                return [2 /*return*/];
        }
    });
}); };
/**
 * Destroy all API Gateways.
 *
 * @async
 * @returns {Promise<void>}
 */
var destroyAllGateways = function () { return __awaiter(void 0, void 0, void 0, function () {
    var config, _i, _a, _b, key, value, client, command;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                console.log(chalk_1.default.cyan("[i] Destroying all API Gateways"));
                config = JSON.parse(fs_1.default.readFileSync(configFile));
                _i = 0, _a = Object.entries(config);
                _c.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 5];
                _b = _a[_i], key = _b[0], value = _b[1];
                client = new client_api_gateway_1.APIGatewayClient({
                    region: value.region,
                    credentials: {
                        accessKeyId: aws_access_key,
                        secretAccessKey: aws_secret_key,
                    },
                });
                console.log(chalk_1.default.cyan("[i] Destroying API Gateway: ".concat(key, " : ").concat(value.id, " : ").concat(value.region)));
                command = new client_api_gateway_1.DeleteRestApiCommand({
                    restApiId: value.id,
                });
                return [4 /*yield*/, sleep(30000)];
            case 2:
                _c.sent();
                return [4 /*yield*/, client.send(command)];
            case 3:
                _c.sent();
                console.log(chalk_1.default.green("[\u2713] Destroyed API Gateway: ".concat(key, " : ").concat(value.id, " : ").concat(value.region)));
                _c.label = 4;
            case 4:
                _i++;
                return [3 /*break*/, 1];
            case 5:
                // nullify the config file
                fs_1.default.writeFileSync(configFile, JSON.stringify({}, null, 2));
                console.log(chalk_1.default.green("[✓] Destroyed all API Gateways"));
                return [2 /*return*/];
        }
    });
}); };
/**
 * List all API Gateways.
 *
 * @async
 * @returns {Promise<void>}
 */
var listGateways = function () { return __awaiter(void 0, void 0, void 0, function () {
    var config, _i, _a, _b, key, value;
    return __generator(this, function (_c) {
        console.log(chalk_1.default.cyan("[i] Listing all API Gateways"));
        // read the config file, and list these
        // check if the config file exists
        if (!fs_1.default.existsSync(configFile)) {
            console.log(chalk_1.default.red("[!] Config file does not exist"));
            return [2 /*return*/];
        }
        config = JSON.parse(fs_1.default.readFileSync(configFile));
        //   if list is empty
        if (Object.keys(config).length === 0) {
            console.log(chalk_1.default.red("[!] No API Gateways found"));
            return [2 /*return*/];
        }
        console.log(chalk_1.default.green("[✓] List of API Gateways"));
        for (_i = 0, _a = Object.entries(config); _i < _a.length; _i++) {
            _b = _a[_i], key = _b[0], value = _b[1];
            console.log(chalk_1.default.bgGreen("Name:"), chalk_1.default.green(key));
            console.log(chalk_1.default.bgGreen("ID:"), chalk_1.default.green(value.id));
            console.log(chalk_1.default.bgGreen("Region:"), chalk_1.default.green(value.region));
            console.log("\n");
        }
        return [2 /*return*/];
    });
}); };
/**
 * Main function for API Gateway.
 *
 * @async
 * @param {boolean} initInput - Whether to initialize the API Gateway.
 * @param {string} destroyInput - The ID of the API Gateway to destroy.
 * @param {boolean} destroyAllInput - Whether to destroy all API Gateways.
 * @param {boolean} listInput - Whether to list all API Gateways.
 * @param {string} regionInput - The region to use.
 * @param {string} accessKey - The access key to use.
 * @param {string} secretKey - The secret key to use.
 * @param {string} configInput - The config file to use.
 * @param {boolean} feasibilityInput - Whether to check feasibility.
 * @param {string} feasibilityUrlInput - The URL to check feasibility for.
 * @returns {Promise<void>}
 */
var apiGateway = function (initInput, destroyInput, destroyAllInput, listInput, regionInput, accessKey, secretKey, configInput, feasibilityInput, feasibilityUrlInput) { return __awaiter(void 0, void 0, void 0, function () {
    var keyMask;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log(chalk_1.default.cyan("[i] Loading 'API Gateway' module"));
                if (!feasibilityInput) return [3 /*break*/, 2];
                if (!feasibilityUrlInput) {
                    console.log(chalk_1.default.red("[!] Please provide a URL to check feasibility of"));
                    return [2 /*return*/];
                }
                return [4 /*yield*/, (0, checkFeasibility_js_1.default)(feasibilityUrlInput)];
            case 1:
                _a.sent();
                return [2 /*return*/];
            case 2:
                // configure the access and secret key
                aws_access_key = accessKey || process.env.AWS_ACCESS_KEY_ID || undefined;
                aws_secret_key =
                    secretKey || process.env.AWS_SECRET_ACCESS_KEY || undefined;
                region = regionInput || randomRegion();
                configFile = configInput || "config.json";
                if (!aws_access_key || !aws_secret_key) {
                    console.log(chalk_1.default.red("[!] AWS Access Key or Secret Key not found. Run with -h to see help"));
                    return [2 /*return*/];
                }
                console.log(chalk_1.default.cyan("[i] Using region: ".concat(region)));
                keyMask = function (key) {
                    if (key.length < 6)
                        return key;
                    return key.slice(0, 4) + "..." + key.slice(-4);
                };
                console.log(chalk_1.default.cyan("[i] Using access key: ".concat(keyMask(aws_access_key))));
                if (!initInput) return [3 /*break*/, 4];
                return [4 /*yield*/, createGateway()];
            case 3:
                _a.sent();
                return [3 /*break*/, 11];
            case 4:
                if (!destroyInput) return [3 /*break*/, 6];
                return [4 /*yield*/, destroyGateway(destroyInput)];
            case 5:
                _a.sent();
                return [3 /*break*/, 11];
            case 6:
                if (!destroyAllInput) return [3 /*break*/, 8];
                return [4 /*yield*/, destroyAllGateways()];
            case 7:
                _a.sent();
                return [3 /*break*/, 11];
            case 8:
                if (!listInput) return [3 /*break*/, 10];
                return [4 /*yield*/, listGateways()];
            case 9:
                _a.sent();
                return [3 /*break*/, 11];
            case 10:
                console.log(chalk_1.default.red("[!] Please provide a valid action (-i/--init or -d/--destroy or --destroy-all)"));
                _a.label = 11;
            case 11: return [2 /*return*/];
        }
    });
}); };
exports.default = apiGateway;
