"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setMaxReqQueue = exports.getMaxReqQueue = exports.pushToJsUrls = exports.clearJsUrls = exports.getJsUrls = exports.pushToScope = exports.setScope = exports.getScope = void 0;
var scope = [];
var js_urls = [];
var max_req_queue;
var getScope = function () { return scope; };
exports.getScope = getScope;
var setScope = function (newScope) {
    scope = newScope;
};
exports.setScope = setScope;
var pushToScope = function (item) {
    scope.push(item);
};
exports.pushToScope = pushToScope;
var getJsUrls = function () { return js_urls; };
exports.getJsUrls = getJsUrls;
var clearJsUrls = function () {
    js_urls = [];
};
exports.clearJsUrls = clearJsUrls;
var pushToJsUrls = function (url) {
    js_urls.push(url);
};
exports.pushToJsUrls = pushToJsUrls;
var getMaxReqQueue = function () { return max_req_queue; };
exports.getMaxReqQueue = getMaxReqQueue;
var setMaxReqQueue = function (newMax) {
    max_req_queue = newMax;
};
exports.setMaxReqQueue = setMaxReqQueue;
