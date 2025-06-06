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
import { VM } from "vm2";
import prettier from "prettier";
import * as cheerio from "cheerio";

  /**
   * Asynchronously fetches the given URL and extracts JavaScript file URLs
   * from script tags present in the HTML content.
   *
   * @param {string} url - The URL of the webpage to fetch and parse.
   * @returns {Promise<string[]>} - A promise that resolves to an array of
   * absolute URLs pointing to JavaScript files found in script tags.
   */
const getJSScriptSrc = async (url) => {
  let js_urls = [];
  // get the page source
  const res = await fetch(url);
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
        js_urls.push(absoluteUrl);
      } else if (src.match(/^[^/]/)) {
        // if the src is a relative URL, like `static/js/a.js` find the absolute URL
        // Get directory URL (origin + path without filename)
        const pathParts = new URL(url).pathname.split("/");
        pathParts.pop(); // remove filename from last
        const directory = new URL(url).origin + pathParts.join("/") + "/";

        js_urls.push(directory + src);
      } else {
        js_urls.push(src);
      }
    }
  }

  console.log(
    chalk.green(
      `[✓] Found ${js_urls.length} JS files from the src of script tags`
    )
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
const getLazyResources = async (url) => {
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
  const res = await fetch(webpack_js);
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
    if (func.source.match(/\".js"$/)) {
      console.log(
        chalk.green(`[✓] Found JS chunk having the following source`)
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
  if (user_verified == true) {
    console.log(
      chalk.green("[✓] Proceeding with the selected function to fetch files")
    );
  }

  const urlBuilderFunc = `(() => (${final_Func}))()`;

  const vm = new VM({
    timeout: 2000,
    sandbox: {},
  });

  let js_paths = [];
  try {
    const func = vm.run(urlBuilderFunc);

    // iterate through all integers, till 1000000, and get the output
    for (let i = 0; i < 1000000; i++) {
      const output = func(i);
      if (output.includes("undefined")) {
        continue;
      } else {
        js_paths.push(output);
      }
    }
  } catch (err) {
    console.error("Unsafe or invalid code:", err.message);
    return;
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
 * Extracts the host and directory path from a given URL.
 *
 * @param {string} url - The URL to be processed.
 * @returns {Object} An object containing:
 *   - host: The hostname of the URL (e.g., "vercel.com" or "localhost:3000").
 *   - directory: The directory path, excluding the filename if present (e.g., "/static/js").
 */
const getURLDirectory = (url) => {
  const u = new URL(url);
  const pathname = u.pathname;

  // Remove filename (last part after final /) if it ends with .js or any file extension
  const dir = pathname.replace(/\/[^\/?#]+\.[^\/?#]+$/, "");

  return {
    host: u.host, // e.g., "vercel.com" or "localhost:3000"
    directory: dir, // e.g., "/static/js"
  };
}

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
  console.log(chalk.cyan(`[i] Downloading ${urls.length} JS chunks`));
  fs.mkdirSync(output, { recursive: true });

  const downloadPromises = urls.map(async (url) => {
    try {
      if (url.match(/\.js/)) {
        // get the directory of the url
        const { host, directory } = getURLDirectory(url);
        // make the directory inside the output folder
        const childDir = path.join(output, host, directory);
        fs.mkdirSync(childDir, { recursive: true });
        const res = await fetch(url);
        const file = `// JS Source: ${url}\n${await res.text()}`;
        const filename = url.split("/").pop().match(/[a-zA-Z0-9\.\-_]+\.js/)[0];
        const filePath = path.join(childDir, filename);
        fs.writeFileSync(
          filePath,
          await prettier.format(file, { parser: "babel" })
        );
      }
    } catch (err) {
      console.error(chalk.red(`[!] Failed to download: ${url}`), err.message);
    }
  });

  await Promise.all(downloadPromises);

  console.log(chalk.green(`[✓] Downloaded JS chunks to ${output} directory`));
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
const lazyload = async (url, output) => {
  console.log(chalk.cyan("[i] Loading 'Lazy Load' module"));

  const tech = await frameworkDetect(url);

  if (tech !== null) {
    if (tech.name === "next") {
      console.log(chalk.green("[✓] Next.js detected"));
      console.log(chalk.yellow(`Evidence: ${tech.evidence}`));

      // find the JS files from script src of the webpage
      const jsFiles = await getJSScriptSrc(url);

      // get lazy resources
      const lazyResources = await getLazyResources(url);

      // download the resources
      await downloadFiles([...jsFiles, ...lazyResources], output);
    }
  } else {
    console.log(chalk.red("[!] Framework not detected :("));
    console.log(chalk.magenta(CONFIG.notFoundMessage));
    return;
  }
};

export default lazyload;
