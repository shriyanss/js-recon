import chalk from "chalk";
import path from "path";
import fs from "fs";
import frameworkDetect from "../techDetect/index.js";
import puppeteer from "puppeteer";
import CONFIG from "../globalConfig.js";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;
import inquirer from "inquirer";
import prettier from "prettier";
import * as cheerio from "cheerio";
import { URL } from "url";

// custom request module
import makeRequest from "../utility/makeReq.js";

// sandboxed execution module
import execFunc from "../utility/runSandboxed.js";

import subsequentRequests from "./subsequentRequests.js";
import { getURLDirectory } from "../utility/urlUtils.js";

// globals
let scope = [];
let js_urls = [];
let max_req_queue;

/**
 * Asynchronously fetches the given URL and extracts JavaScript file URLs
 * from script tags present in the HTML content.
 *
 * @param {string} url - The URL of the webpage to fetch and parse.
 * @returns {Promise<string[]>} - A promise that resolves to an array of
 * absolute URLs pointing to JavaScript files found in script tags.
 */
const next_getJSScript = async (url) => {
  // get the page source
  const res = await makeRequest(url);
  const pageSource = await res.text();

  // cheerio to parse the page source
  const $ = cheerio.load(pageSource);

  // find all script tags
  const scriptTags = $("script");

  // iterate through script tags
  for (const scriptTag of scriptTags) {
    // get the src attribute
    const src = $(scriptTag).attr("src");

    // see if the src is a JS file
    if (
      src !== undefined &&
      src.match(/(https:\/\/[a-zA-Z0-9_\_\.]+\/.+\.js\??.*|\/.+\.js\??.*)/)
    ) {
      // if the src starts with /, like `/static/js/a.js` find the absolute URL
      if (src.startsWith("/")) {
        const absoluteUrl = new URL(url).origin + src;
        if (!js_urls.includes(absoluteUrl)) {
          js_urls.push(absoluteUrl);
        }
      } else if (src.match(/^[^/]/)) {
        // if the src is a relative URL, like `static/js/a.js` find the absolute URL
        // Get directory URL (origin + path without filename)
        const pathParts = new URL(url).pathname.split("/");
        pathParts.pop(); // remove filename from last
        const directory = new URL(url).origin + pathParts.join("/") + "/";

        if (!js_urls.includes(directory + src)) {
          js_urls.push(directory + src);
        }
      } else {
        if (!js_urls.includes(src)) {
          js_urls.push(src);
        }
      }
    } else {
      // if the script tag is inline, it could contain static JS URL
      // to get these, simply regex from the JS script

      const js_script = $(scriptTag).html();
      const matches = js_script.match(/static\/chunks\/[a-zA-Z0-9_\-]+\.js/g);

      if (matches) {
        const uniqueMatches = [...new Set(matches)];
        for (const match of uniqueMatches) {
          // if it is using that static/chunks/ pattern, I can just get the filename
          const filename = match.replace("static/chunks/", "");

          // go through the already found URLs, coz they will have it (src attribute
          // is there before inline things)

          let js_path_dir;

          for (const js_url of js_urls) {
            if (
              !js_path_dir &&
              new URL(js_url).host === new URL(url).host &&
              new URL(js_url).pathname.includes("static/chunks/")
            ) {
              js_path_dir = js_url.replace(/\/[^\/]+\.js.*$/, "");
            }
          }
          js_urls.push(js_path_dir + "/" + filename);
        }
      }
    }
  }

  console.log(
    chalk.green(`[✓] Found ${js_urls.length} JS files from the script tags`),
  );

  return js_urls;
};

/**
 * Asynchronously fetches the given URL and extracts JavaScript file URLs
 * from webpack's require.ensure() function.
 *
 * @param {string} url - The URL of the webpage to fetch and parse.
 * @returns {Promise<string[]>} - A promise that resolves to an array of
 * absolute URLs pointing to JavaScript files found in require.ensure()
 * functions.
 */
const next_getLazyResources = async (url) => {
  const browser = await puppeteer.launch({
    headless: true,
  });

  const page = await browser.newPage();

  await page.setRequestInterception(true);

  page.on("request", async (request) => {
    // get the request url
    const url = request.url();

    // see if the request is a JS file, and is a get request
    if (
      request.method() === "GET" &&
      url.match(/https?:\/\/[a-z\._\-]+\/.+\.js\??.*/)
    ) {
      if (!js_urls.includes(url)) {
        js_urls.push(url);
      }
    }

    await request.continue();
  });

  await page.goto(url);

  await browser.close();

  let webpack_js;

  // iterate through JS files
  for (const js_url of js_urls) {
    // match for webpack js file
    if (js_url.match(/\/webpack.*\.js/)) {
      console.log(chalk.green(`[✓] Found webpack JS file at ${js_url}`));
      webpack_js = js_url;
    }
  }

  if (!webpack_js) {
    console.log(chalk.red("[!] No webpack JS file found"));
    console.log(chalk.magenta(CONFIG.notFoundMessage));
    return;
  }

  // parse the webpack JS file
  const res = await makeRequest(webpack_js);
  const webpack_js_source = await res.text();

  // parse it with @babel/*
  const ast = parser.parse(webpack_js_source, {
    sourceType: "unambiguous",
    plugins: ["jsx", "typescript"],
  });

  let functions = [];

  traverse(ast, {
    FunctionDeclaration(path) {
      functions.push({
        name: path.node.id?.name || "(anonymous)",
        type: "FunctionDeclaration",
        source: webpack_js_source.slice(path.node.start, path.node.end),
      });
    },
    FunctionExpression(path) {
      functions.push({
        name: path.parent.id?.name || "(anonymous)",
        type: "FunctionExpression",
        source: webpack_js_source.slice(path.node.start, path.node.end),
      });
    },
    ArrowFunctionExpression(path) {
      functions.push({
        name: path.parent.id?.name || "(anonymous)",
        type: "ArrowFunctionExpression",
        source: webpack_js_source.slice(path.node.start, path.node.end),
      });
    },
    ObjectMethod(path) {
      functions.push({
        name: path.node.key.name,
        type: "ObjectMethod",
        source: webpack_js_source.slice(path.node.start, path.node.end),
      });
    },
    ClassMethod(path) {
      functions.push({
        name: path.node.key.name,
        type: "ClassMethod",
        source: webpack_js_source.slice(path.node.start, path.node.end),
      });
    },
  });

  let user_verified = false;
  // method 1
  // iterate through the functions, and find out which one ends with `".js"`

  let final_Func;
  for (const func of functions) {
    if (func.source.match(/"\.js".{0,15}$/)) {
      console.log(
        chalk.green(`[✓] Found JS chunk having the following source`),
      );
      console.log(chalk.yellow(func.source));
      final_Func = func.source;
    }
  }

  //   ask through input if this is the right thing
  const askCorrectFuncConfirmation = async () => {
    const { confirmed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmed",
        message: "Is this the correct function?",
        default: true,
      },
    ]);
    return confirmed;
  };

  user_verified = await askCorrectFuncConfirmation();
  if (user_verified === true) {
    console.log(
      chalk.green("[✓] Proceeding with the selected function to fetch files"),
    );
  } else {
    console.log(chalk.red("[!] Not executing function."));
    return [];
  }

  const urlBuilderFunc = `(() => (${final_Func}))()`;

  let js_paths = [];
  try {
    // rather than fuzzing, grep the integers from the func code
    const integers = final_Func.match(/\d+/g);

    // iterate through all integers, till 1000000, and get the output
    for (const i of integers) {
      const output = execFunc(urlBuilderFunc, parseInt(i));
      if (output.includes("undefined")) {
        continue;
      } else {
        js_paths.push(output);
      }
    }
  } catch (err) {
    console.error("Unsafe or invalid code:", err.message);
    return [];
  }

  if (js_paths.length > 0) {
    console.log(chalk.green(`[✓] Found ${js_paths.length} JS chunks`));
  }

  // build final URL
  let final_urls = [];
  for (let i = 0; i < js_paths.length; i++) {
    // get the directory of webpack file
    const webpack_dir = webpack_js.split("/").slice(0, -1).join("/");
    // replace the filename from the js path
    const js_path_dir = js_paths[i].replace(/\/[a-zA-Z0-9\.]+\.js.*$/, "");
    const final_url = webpack_dir.replace(js_path_dir, js_paths[i]);
    final_urls.push(final_url);
  }

  return final_urls;
};

/**
 * Downloads a list of URLs and saves them as files in the specified output directory.
 * It creates the necessary subdirectories based on the URL's host and path.
 * If the URL does not end with `.js`, it is skipped.
 * The function logs the progress and any errors to the console.
 * @param {string[]} urls - An array of URLs to be downloaded.
 * @param {string} output - The directory where the downloaded files will be saved.
 * @returns {Promise<void>}
 */
const downloadFiles = async (urls, output) => {
  console.log(
    chalk.cyan(`[i] Attempting to download ${urls.length} JS chunks`),
  );
  fs.mkdirSync(output, { recursive: true });

  // to store ignored JS domain
  let ignoredJSFiles = [];
  let ignoredJSDomains = [];

  let download_count = 0;
  let queue = 0;

  const downloadPromises = urls.map(async (url) => {
    try {
      if (url.match(/\.js/)) {
        // get the directory of the url
        const { host, directory } = getURLDirectory(url);

        // check scope of file. Only if in scope, download it
        if (!scope.includes("*")) {
          if (!scope.includes(host)) {
            ignoredJSFiles.push(url);
            if (!ignoredJSDomains.includes(host)) {
              ignoredJSDomains.push(host);
            }
            return;
          }
        }

        // make the directory inside the output folder
        const childDir = path.join(output, host, directory);
        fs.mkdirSync(childDir, { recursive: true });

        // check if queue is full. If so, then wait for random time between
        // 50 to 300 ms. Then, check again, and loop the process
        while (queue >= max_req_queue) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 250 + 50),
          );
        }
        queue++;
        const res = await makeRequest(url);
        queue--;

        const file = `// JS Source: ${url}\n${await res.text()}`;
        let filename;
        try {
          filename = url
            .split("/")
            .pop()
            .match(/[a-zA-Z0-9\.\-_]+\.js/)[0];
        } catch (err) {
          // split the URL into multiple chunks. then iterate
          // through it, and find whatever matches with JS ext
          const chunks = url.split("/");
          for (const chunk of chunks) {
            if (chunk.match(/\.js$/)) {
              filename = chunk;
              break;
            }
          }
        }

        const filePath = path.join(childDir, filename);
        fs.writeFileSync(
          filePath,
          await prettier.format(file, { parser: "babel" }),
        );
        download_count++;
      }
    } catch (err) {
      console.error(chalk.red(`[!] Failed to download: ${url}`));
    }
  });

  await Promise.all(downloadPromises);

  if (ignoredJSFiles.length > 0) {
    console.log(
      chalk.yellow(
        `[i] Ignored ${ignoredJSFiles.length} JS files across ${ignoredJSDomains.length} domain(s) - ${ignoredJSDomains.join(", ")}`,
      ),
    );
  }

  if (download_count > 0) {
    console.log(
      chalk.green(
        `[✓] Downloaded ${download_count} JS chunks to ${output} directory`,
      ),
    );
  }
};

/**
 * Downloads all the lazy loaded JS files from a given URL.
 *
 * It opens a headless browser instance, navigates to the given URL, and
 * intercepts all the requests. It checks if the request is a JS file
 * and if it is a GET request. If both conditions are satisfied, the URL
 * is added to the array of URLs. Finally, it closes the browser instance
 * and returns the array of URLs.
 *
 * @param {string} url - The URL of the webpage to fetch and parse.
 * @returns {Promise<string[]>} - A promise that resolves to an array of
 * absolute URLs pointing to JavaScript files found in the page.
 */
const downloadLoadedJs = async (url) => {
  if (!url.match(/https?:\/\/[a-zA-Z0-9\._\-]+/)) {
    console.log(chalk.red("[!] Invalid URL"));
    return;
  }

  const browser = await puppeteer.launch({
    headless: true,
  });

  const page = await browser.newPage();

  await page.setRequestInterception(true);

  let js_urls = [];
  page.on("request", async (request) => {
    // get the request url
    const url = request.url();

    // see if the request is a JS file, and is a get request
    if (
      request.method() === "GET" &&
      url.match(/https?:\/\/[a-z\._\-]+\/.+\.js\??.*/)
    ) {
      js_urls.push(url);
    }

    await request.continue();
  });

  await page.goto(url);

  await browser.close();

  return js_urls;
};

/**
 * Downloads all the lazy loaded JS files from a given URL.
 * It detects Next.js by looking for the presence of a webpack JS file
 * and uses the following techniques to find the lazy loaded files:
 * 1. Finds the webpack JS file by looking for a script tag with a src
 *    attribute that starts with "/next/". This is done by iterating through
 *    all script tags and checking the src attribute.
 * 2. Parses the webpack JS file to find functions that end with ".js". These
 *    functions are assumed to return the path of the lazy loaded JS file.
 * 3. Iterates through all integers, till 1000000, and passes it to the found
 *    function to get the output. If the output does not include "undefined",
 *    it is added to the list of lazy loaded files.
 * 4. Downloads the lazy loaded files and saves them as files in the specified
 *    output directory.
 * @param {string} url - The URL to be processed.
 * @param {string} output - The directory where the downloaded files will be saved.
 * @returns {Promise<void>}
 */
const lazyLoad = async (
  url,
  output,
  strictScope,
  inputScope,
  threads,
  subsequentRequestsFlag,
  urlsFile,
) => {
  console.log(chalk.cyan("[i] Loading 'Lazy Load' module"));

  let urls;

  // check if the url is file or a URL
  if (fs.existsSync(url)) {
    urls = fs.readFileSync(url, "utf-8").split("\n");
    // remove the empty lines
    urls = urls.filter((url) => url.trim() !== "");
  } else if (url.match(/https?:\/\/[a-zA-Z0-9\-_\.:]+/)) {
    urls = [url];
  } else {
    console.log(chalk.red("[!] Invalid URL or file path"));
    return;
  }

  for (const url of urls) {
    console.log(chalk.cyan(`[i] Processing ${url}`));

    if (strictScope) {
      scope.push(new URL(url).host);
    } else {
      scope = inputScope;
    }

    max_req_queue = threads;

    const tech = await frameworkDetect(url);

    if (tech) {
      if (tech.name === "next") {
        console.log(chalk.green("[✓] Next.js detected"));
        console.log(chalk.yellow(`Evidence: ${tech.evidence}`));

        // find the JS files from script src of the webpage
        const jsFilesFromScriptTag = await next_getJSScript(url);

        // get lazy resources
        const lazyResourcesFromWebpack = await next_getLazyResources(url);
        let lazyResourcesFromSubsequentRequests;

        if (subsequentRequestsFlag) {
          // get JS files from subsequent requests
          lazyResourcesFromSubsequentRequests = await subsequentRequests(
            url,
            urlsFile,
            threads,
            output,
            js_urls
          );
        }

        // download the resources
        // but combine them first
        let jsFilesToDownload = [...(jsFilesFromScriptTag || []), ...(lazyResourcesFromWebpack || []), ...(lazyResourcesFromSubsequentRequests || [])];

        // dedupe the files
        jsFilesToDownload = [...new Set(jsFilesToDownload)];

        await downloadFiles(jsFilesToDownload, output);
      }
    } else {
      console.log(chalk.red("[!] Framework not detected :("));
      console.log(chalk.magenta(CONFIG.notFoundMessage));
      console.log(chalk.yellow("[i] Trying to download loaded JS files"));
      const js_urls = await downloadLoadedJs(url);
      if (js_urls && js_urls.length > 0) {
        console.log(chalk.green(`[✓] Found ${js_urls.length} JS chunks`));
        await downloadFiles(js_urls, output);
      }
    }
  }
};

export default lazyLoad;
