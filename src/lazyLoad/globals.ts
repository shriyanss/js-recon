let scope = [];
let js_urls = [];
let json_urls = [];
let max_req_queue;

export const getScope = () => scope;
export const setScope = (newScope) => {
    scope = newScope;
};
export const pushToScope = (item) => {
    scope.push(item);
};

export const getJsUrls = () => js_urls;
export const clearJsUrls = () => {
    js_urls = [];
};
export const pushToJsUrls = (url) => {
    js_urls.push(url);
};

export const getJsonUrls = () => json_urls;
export const pushToJsonUrls = (url: string) => json_urls.push(url);

export const getMaxReqQueue = () => max_req_queue;
export const setMaxReqQueue = (newMax) => {
    max_req_queue = newMax;
};
