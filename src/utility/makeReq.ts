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

const writeCache = async (url: string, headers: {}, response: Response) => {
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

const makeRequest = async (
    url: string,
    args?: Omit<RequestInit, "timeout"> & { timeout?: number }
): Promise<Response | null> => {
    const requestOptions: RequestInit = { ...args, timeout: args?.timeout || globals.getRequestTimeout() };

    // if cache is enabled, read the cache and return if cache is present. else, continue
    if (!globals.getDisableCache()) {
        const cachedResponse = await readCache(url, requestOptions.headers || {});
        if (cachedResponse !== null) {
            return cachedResponse;
        }
    }

    if (globals.useApiGateway) {
        let get_headers;
        if (requestOptions && requestOptions.headers) {
            get_headers = requestOptions.headers;
        } else {
            get_headers = {
                "User-Agent": UAs[Math.floor(Math.random() * UAs.length)],
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "Accept-Language": "en-US,en;q=0.9",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Dest": "empty",
                Referer: url,
                Origin: url,
            };
        }

        const body = await get(url, get_headers);

        // craft a Response, and return that
        const response = new Response(body);

        // if cache is enabled, write the response to the cache
        if (!globals.getDisableCache()) {
            await writeCache(url, get_headers, response);
        }
        return response;
    } else {
        let res: Response;
        let counter = 0;
        while (true) {
            try {
                EventEmitter.defaultMaxListeners = 20;
                res = await fetch(url, requestOptions);
                if (res) {
                    break;
                }
            } catch (err) {
                counter++;
                // BUG: https://github.com/nodejs/node/issues/47246
                // if the header content is too large, it will throw an error like
                // code: `UND_ERR_HEADERS_OVERFLOW`
                // so, if this error happens, tell the user to fix it using setting the environment variables
                // if this is docker, this will be increased by default
                if (err.cause && err.cause.code === "UND_ERR_HEADERS_OVERFLOW") {
                    console.log(
                        chalk.yellow(
                            `[!] The tool detected a header overflow. Please increase the limit by setting environment variable \`NODE_OPTIONS="--max-http-header-size=99999999"\`. If the error still persists, please try again with a higher limit.`
                        )
                    );
                    process.exit(21);
                }
                if (counter > 10) {
                    console.log(chalk.red(`[!] Failed to fetch ${url} : ${err}`));
                    return null;
                }
                // sleep 0.5 s before retrying
                await new Promise((resolve) => setTimeout(resolve, 500));
                continue;
            }
        }

        const preservedRes = res.clone();
        const preservedRes2 = res.clone();

        // check if this is a firewall
        // CF first
        const resp_text = await res.text();
        if (resp_text.includes("/?bm-verify=")) {
            console.log(chalk.yellow(`[!] CF Firewall detected. Trying to bypass with headless browser`));
            // if it is, load it in a headless browser
            const browser = await puppeteer.launch({
                headless: true,
                args: process.env.IS_DOCKER === "true" ? ["--no-sandbox"] : [],
            });
            const page = await browser.newPage();
            await page.goto(url);
            await new Promise((resolve) => setTimeout(resolve, 5000));
            const content = await page.content();
            await browser.close();

            // if cache is enabled, write the response to the cache
            if (!globals.getDisableCache()) {
                await writeCache(url, {}, new Response(content));
            }
            return new Response(content);
        } else if (resp_text.includes("<title>Just a moment...</title>")) {
            console.log(chalk.yellow(`[!] CF Firewall detected. Trying to bypass with headless browser`));
            // if it is, load it in a headless browser
            const browser = await puppeteer.launch({
                headless: true,
                args: process.env.IS_DOCKER ? ["--no-sandbox"] : [],
            });
            const page = await browser.newPage();
            await page.goto(url);
            await new Promise((resolve) => setTimeout(resolve, 5000));
            const content = await page.content();
            await browser.close();

            // if cache is enabled, write the response to the cache
            if (!globals.getDisableCache()) {
                await writeCache(url, {}, new Response(content));
            }
            return new Response(content);
        }

        // if cache is enabled, write the response to the cache
        if (!globals.getDisableCache()) {
            const resToCache = preservedRes.clone();
            await writeCache(url, requestOptions.headers || {}, resToCache);
        }
        return preservedRes2;
    }
};

export default makeRequest;
