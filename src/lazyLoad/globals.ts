/** Global scope configuration for lazy loading */
let scope: string[] = [];
/** Global array of JavaScript URLs discovered during lazy loading */
let js_urls: string[] = [];
/** Global array of JSON URLs discovered during lazy loading */
let json_urls: string[] = [];
/** Maximum number of concurrent requests allowed */
let max_req_queue: number;

/**
 * Gets the current scope configuration.
 * @returns Array of domains in scope
 */
export const getScope = (): string[] => scope;

/**
 * Sets the scope configuration for lazy loading.
 * @param newScope - Array of domains to include in scope
 */
export const setScope = (newScope: string[]): void => {
    scope = newScope;
};

/**
 * Adds a domain to the current scope.
 * @param item - Domain to add to scope
 */
export const pushToScope = (item: string): void => {
    scope.push(item);
};

/**
 * Gets the current array of JavaScript URLs.
 * @returns Array of JavaScript URLs
 */
export const getJsUrls = (): string[] => js_urls;

/**
 * Clears all JavaScript URLs from the global array.
 */
export const clearJsUrls = (): void => {
    js_urls = [];
};

/**
 * Adds a JavaScript URL to the global array.
 * @param url - JavaScript URL to add
 */
export const pushToJsUrls = (url: string): void => {
    js_urls.push(url);
};

/**
 * Gets the current array of JSON URLs.
 * @returns Array of JSON URLs
 */
export const getJsonUrls = (): string[] => json_urls;

/**
 * Clears all JSON URLs from the global array.
 */
export const clearJsonUrls = (): void => {
    json_urls = [];
};

/**
 * Adds a JSON URL to the global array.
 * @param url - JSON URL to add
 */
export const pushToJsonUrls = (url: string): void => {
    json_urls.push(url);
};

/**
 * Gets the maximum request queue size.
 * @returns Maximum number of concurrent requests
 */
export const getMaxReqQueue = (): number => max_req_queue;

/**
 * Sets the maximum request queue size.
 * @param newMax - Maximum number of concurrent requests to allow
 */
export const setMaxReqQueue = (newMax: number): void => {
    max_req_queue = newMax;
};
