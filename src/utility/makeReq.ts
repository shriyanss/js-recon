import chalk from "chalk";
import puppeteer from "puppeteer";
import * as globals from "./globals.js";
import { get } from "../api_gateway/genReq.js";
import fs from "fs";
import { EventEmitter } from "events";

// random user agents
const UAs = [
    "Chrome/Windows: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Chrome/Windows: Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Chrome/Windows: Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Chrome/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Chrome/Linux: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Chrome/iPhone: Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/87.0.4280.77 Mobile/15E148 Safari/604.1",
    "Chrome/iPhone (request desktop): Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/87 Version/11.1.1 Safari/605.1.15",
    "Chrome/iPad: Mozilla/5.0 (iPad; CPU OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/87.0.4280.77 Mobile/15E148 Safari/604.1",
    "Chrome/iPod: Mozilla/5.0 (iPod; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/87.0.4280.77 Mobile/15E148 Safari/604.1",
    "Chrome/Android: Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Mobile Safari/537.36",
    "Chrome/Android: Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Mobile Safari/537.36",
    "Chrome/Android: Mozilla/5.0 (Linux; Android 10; LM-Q720) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Mobile Safari/537.36",
    "Firefox/Windows: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:84.0) Gecko/20100101 Firefox/84.0",
    "Firefox/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11.1; rv:84.0) Gecko/20100101 Firefox/84.0",
    "Firefox/Linux: Mozilla/5.0 (X11; Linux i686; rv:84.0) Gecko/20100101 Firefox/84.0",
    "Firefox/iPhone: Mozilla/5.0 (iPhone; CPU iPhone OS 11_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/30.0 Mobile/15E148 Safari/605.1.15",
    "Firefox/iPad: Mozilla/5.0 (iPad; CPU OS 11_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/30.0 Mobile/15E148 Safari/605.1.15",
    "Firefox/Android: Mozilla/5.0 (Android 11; Mobile; rv:68.0) Gecko/68.0 Firefox/84.0",
    "Safari/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.2 Safari/605.1.15",
    "Safari/iPhone: Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
    "Safari/iPhone (request desktop): Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15",
    "Safari/iPad: Mozilla/5.0 (iPad; CPU OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
    "IE11/Windows: Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko",
    "Edge/Windows: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Edg/87.0.664.66",
    "Edge/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Edg/87.0.664.66",
    "Edge/Android: Mozilla/5.0 (Linux; Android 10; HD1913) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Mobile Safari/537.36 EdgA/45.12.4.5121",
    "Edge/iOS: Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 EdgiOS/45.11.11 Mobile/15E148 Safari/605.1.15",
    "Opera/Windows: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 OPR/73.0.3856.329",
    "Opera/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 OPR/73.0.3856.329",
    "Opera/Linux: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 OPR/73.0.3856.329",
    "Opera/Android: Mozilla/5.0 (Linux; Android 10; VOG-L29) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Mobile Safari/537.36 OPR/61.1.3076.56625",
    "Vivaldi/Windows: Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Vivaldi/3.5",
    "Vivaldi/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Vivaldi/3.5",
    "Vivaldi/Linux: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Vivaldi/3.5",
    "Yandex/Windows: Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 YaBrowser/20.12.0 Yowser/2.5 Safari/537.36",
    "Yandex/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 YaBrowser/20.12.0 Yowser/2.5 Safari/537.36",
    "Yandex/iOS: Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 YaBrowser/20.11.2.199 Mobile/15E148 Safari/604.1",
    "Yandex/Android: Mozilla/5.0 (Linux; arm_64; Android 11; SM-G965F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 YaBrowser/20.12.29.180 Mobile Safari/537.36",
    "Chrome/ChromeOS: Mozilla/5.0 (X11; CrOS x86_64 13505.63.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Safari/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.2 Safari/605.1.15",
    "Firefox/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11.1; rv:84.0) Gecko/20100101 Firefox/84.0",
    "Chrome/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Vivaldi/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Vivaldi/3.5",
    "Edge/macOS: Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Edg/87.0.664.66",
    "Safari/iOS: Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
    "Chrome/iOS: Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/87.0.4280.77 Mobile/15E148 Safari/604.1",
    "Firefox/iOS: Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/30.0 Mobile/15E148 Safari/605.1.15",
    "Edge/Windows: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Edg/87.0.664.66",
    "Internet-Explorer/Windows: Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko",
    "Chrome/Windows: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Firefox/Windows: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:84.0) Gecko/20100101 Firefox/84.0",
    "Vivaldi/Windows: Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Vivaldi/3.5",
    "Chrome/Android: Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Mobile Safari/537.36",
    "Firefox/Android: Mozilla/5.0 (Android 11; Mobile; rv:68.0) Gecko/68.0 Firefox/84.0",
];

/**
 * Reads response data from cache for future requests.
 *
 * If the cache file exists, and the given URL is present in the cache,
 * it checks if the response contains the specific request headers. If it does,
 * it builds a Response object with the cached data and returns it.
 *
 * If the response does not contain the request headers, or if the cache file
 * does not exist, or if the URL is not present in the cache, it returns null.
 *
 * @param url - The URL to read the cache for
 * @param headers - Request headers that were used
 * @returns A Promise that resolves to a Response object if the cache is found, or null if not
 */
const readCache = async (url: string, headers: {}): Promise<Response | null> => {
    // first, check if the file exists or not
    if (!fs.existsSync(globals.getRespCacheFile())) {
        return null;
    }

    // console.log("reading cache for", url);
    // open the cache file, build a Response, and return
    const cache = JSON.parse(fs.readFileSync(globals.getRespCacheFile(), "utf-8"));
    if (cache[url]) {
        // check if the response contains the specific request headers
        // iterate through cache[url] and build a Response

        let headersMatch = true;

        // first check if the essential headers match
        const rscEnabled = headers["RSC"] ? true : false;
        if (rscEnabled) {
            if (cache[url].rsc) {
                return new Response(Buffer.from(cache[url].rsc.body_b64, "base64"), {
                    status: cache[url].rsc.status,
                    headers: cache[url].rsc.resp_headers,
                });
            }
        }
        if (!rscEnabled && cache[url] && cache[url].normal) {
            return new Response(Buffer.from(cache[url].normal.body_b64, "base64"), {
                status: cache[url].normal.status,
                headers: cache[url].normal.resp_headers,
            });
        }
    }
    // console.log("cache not found for ", url);
    return null;
};

/**
 * Writes response data to cache for future requests.
 *
 * Stores response body, status, and headers in cache file, handling special
 * cases like RSC (React Server Components) headers separately.
 *
 * @param url - The URL to cache the response for
 * @param headers - Request headers that were used
 * @param response - The Response object to cache
 * @returns Promise that resolves when caching is complete
 */
const writeCache = async (url: string, headers: {}, response: Response): Promise<void> => {
    // clone the response
    const clonedResponse = response.clone();

    // if cache exists, return
    if ((await readCache(url, headers)) !== null) {
        // console.log("cache already exists for ", url);
        return;
    }

    // open the cache file, and write the response based on the special headers
    const cache = JSON.parse(fs.readFileSync(globals.getRespCacheFile(), "utf-8"));
    if (!cache[url]) {
        cache[url] = {};
    }

    const body = Buffer.from(await clonedResponse.arrayBuffer()).toString("base64");
    const status = clonedResponse.status;
    const resp_headers = clonedResponse.headers;
    if (headers["RSC"]) {
        cache[url].rsc = {
            req_headers: headers,
            status: status,
            body_b64: body,
            resp_headers: resp_headers,
        };
        // console.log("rsc", url);
    } else {
        cache[url].normal = {
            req_headers: headers,
            status: status,
            body_b64: body,
            resp_headers: resp_headers,
        };
        // console.log("normal", url);
    }
    fs.writeFileSync(globals.getRespCacheFile(), JSON.stringify(cache));
    // console.log("wrote cache for ", url);
};

/**
 * Performs a single fetch request with retry logic.
 *
 * @param url - The URL to request
 * @param requestOptions - Request options including headers
 * @param requestTimeout - Timeout in milliseconds
 * @returns A Promise that resolves to a Response, or null if all retries fail
 */
const singleFetch = async (
    url: string,
    requestOptions: RequestInit,
    requestTimeout: number
): Promise<Response | null> => {
    let res: Response;
    let counter = 0;

    while (true) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), requestTimeout);
        const currentRequestOptions = {
            ...requestOptions,
            signal: controller.signal,
        };

        try {
            EventEmitter.defaultMaxListeners = 20;
            res = await fetch(url, currentRequestOptions);
            clearTimeout(timeoutId);
            if (res) {
                break;
            }
        } catch (err) {
            clearTimeout(timeoutId);
            counter++;
            // BUG: https://github.com/nodejs/node/issues/47246
            if (err.cause && err.cause.code === "UND_ERR_HEADERS_OVERFLOW") {
                console.log(
                    chalk.yellow(
                        `[!] The tool detected a header overflow. Please increase the limit by setting environment variable \`NODE_OPTIONS="--max-http-header-size=99999999"\`. If the error still persists, please try again with a higher limit.`
                    )
                );
                process.exit(21);
            }
            if (err.name === "AbortError") {
                console.log(chalk.red(`[!] Request to ${url} timed out after ${requestTimeout}ms`));
                return null;
            }
            if (counter > 10) {
                console.log(chalk.red(`[!] Failed to fetch ${url} : ${err}`));
                console.log(chalk.dim("[i] Often, using -k flag (ignore SSL errors) fixes the problem"));
                return null;
            }
            // sleep 0.5 s before retrying
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
        }
    }
    return res;
};

/**
 * Handles firewall detection and bypass using headless browser.
 *
 * @param url - The URL being requested
 * @param resp_text - The response text to check for firewall signatures
 * @returns A Promise that resolves to Response content if firewall detected, or null if not
 */
const handleFirewall = async (url: string, resp_text: string): Promise<string | null> => {
    if (resp_text.includes("/?bm-verify=") || resp_text.includes("<title>Just a moment...</title>")) {
        console.log(chalk.yellow(`[!] CF Firewall detected. Trying to bypass with headless browser`));
        const browser = await puppeteer.launch({
            headless: true,
            args: globals.getDisableSandbox() ? ["--no-sandbox", "--disable-setuid-sandbox"] : [],
        });
        const page = await browser.newPage();
        await page.goto(url);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const content = await page.content();
        await browser.close();
        return content;
    }
    return null;
};

/**
 * Makes a GET request to the given URL and returns the response.
 *
 * If caching is enabled, it will first check if the response is cached.
 * If it is, it will return the cached response. If not, it will make the request
 * using the given options, and cache the response before returning it.
 *
 * When no custom headers are provided, tries both with and without Referer header,
 * returning the successful (200) response.
 *
 * If the request fails, it will retry up to 10 times with 0.5s of sleep in between.
 * If all retries fail, it will return null.
 *
 * @param url - The URL to request
 * @param args - Request options
 * @returns A Promise that resolves to a Response, or null if all retries fail
 */
const makeRequest = async (
    url: string,
    args?: Omit<RequestInit, "timeout"> & { timeout?: number }
): Promise<Response | null> => {
    const { timeout, ...restArgs } = args || {};
    const requestOptions: RequestInit = restArgs;
    const requestTimeout = timeout || globals.getRequestTimeout();
    const usingDefaultHeaders = !requestOptions.headers;

    // Build default headers if not provided
    const baseHeaders = {
        "User-Agent": UAs[Math.floor(Math.random() * UAs.length)],
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
    };

    if (!requestOptions.headers) {
        requestOptions.headers = {
            ...baseHeaders,
            Referer: new URL(url).origin,
            Origin: new URL(url).origin,
        };
    }

    // if cache is enabled, read the cache and return if cache is present. else, continue
    if (!globals.getDisableCache()) {
        const cachedResponse = await readCache(url, requestOptions.headers || {});
        if (cachedResponse !== null) {
            return cachedResponse;
        }
    }

    if (globals.useApiGateway) {
        const get_headers = requestOptions.headers;

        const body = await get(url, get_headers);

        // craft a Response, and return that
        const response = new Response(body);

        // if cache is enabled, write the response to the cache
        if (!globals.getDisableCache()) {
            await writeCache(url, get_headers, response);
        }
        return response;
    } else {
        // When using default headers, try both with and without Referer/Origin
        // to handle servers that return 404 for one but 200 for the other
        if (usingDefaultHeaders) {
            // First try: with Referer and Origin
            const headersWithReferer = {
                ...baseHeaders,
                Referer: new URL(url).origin,
                Origin: new URL(url).origin,
            };
            const resWithReferer = await singleFetch(
                url,
                { ...requestOptions, headers: headersWithReferer },
                requestTimeout
            );

            if (resWithReferer && resWithReferer.ok) {
                // Check for firewall
                const clonedRes = resWithReferer.clone();
                const resp_text = await clonedRes.text();
                const firewallContent = await handleFirewall(url, resp_text);
                if (firewallContent) {
                    if (!globals.getDisableCache()) {
                        await writeCache(url, headersWithReferer, new Response(firewallContent));
                    }
                    return new Response(firewallContent);
                }

                // Cache and return successful response
                if (!globals.getDisableCache()) {
                    await writeCache(url, headersWithReferer, resWithReferer.clone());
                }
                return resWithReferer;
            }

            // Second try: without Referer and Origin
            const headersWithoutReferer = { ...baseHeaders };
            const resWithoutReferer = await singleFetch(
                url,
                { ...requestOptions, headers: headersWithoutReferer },
                requestTimeout
            );

            if (resWithoutReferer && resWithoutReferer.ok) {
                // Check for firewall
                const clonedRes = resWithoutReferer.clone();
                const resp_text = await clonedRes.text();
                const firewallContent = await handleFirewall(url, resp_text);
                if (firewallContent) {
                    if (!globals.getDisableCache()) {
                        await writeCache(url, headersWithoutReferer, new Response(firewallContent));
                    }
                    return new Response(firewallContent);
                }

                // Cache and return successful response
                if (!globals.getDisableCache()) {
                    await writeCache(url, headersWithoutReferer, resWithoutReferer.clone());
                }
                return resWithoutReferer;
            }

            // Both failed, return whichever response we got (prefer non-null)
            const finalRes = resWithReferer || resWithoutReferer;
            if (finalRes) {
                if (!globals.getDisableCache()) {
                    await writeCache(url, headersWithReferer, finalRes.clone());
                }
            }
            return finalRes;
        } else {
            // Custom headers provided, use them directly
            const res = await singleFetch(url, requestOptions, requestTimeout);
            if (!res) return null;

            const preservedRes = res.clone();
            const preservedRes2 = res.clone();

            // Check for firewall
            const resp_text = await res.text();
            const firewallContent = await handleFirewall(url, resp_text);
            if (firewallContent) {
                if (!globals.getDisableCache()) {
                    await writeCache(url, requestOptions.headers || {}, new Response(firewallContent));
                }
                return new Response(firewallContent);
            }

            // Cache and return
            if (!globals.getDisableCache()) {
                await writeCache(url, requestOptions.headers || {}, preservedRes.clone());
            }
            return preservedRes2;
        }
    }
};

export default makeRequest;
