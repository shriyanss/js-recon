import chalk from "chalk";
import fs from "fs";
import path from "path";
import { getURLDirectory } from "../utility/urlUtils.js";
// custom request module
import makeRequest from "../utility/makeReq.js";

let queue = [];
let max_queue;

/**
 * Given a string of JS content, it finds all the static files used in the
 * file, and returns them as an array.
 *
 * @param {string} js_content - The string of JS content to search through.
 *
 * @returns {string[]} An array of strings, each string being a static file
 * path.
 */
const findStaticFiles = async (js_content) => {
  // do some regex-ing
  const matches = [
    ...js_content.matchAll(/\/?static\/chunks\/[a-zA-Z0-9\._\-\/]+\.js/g),
  ];
  // return matches

  let toReturn = [];

  for (const match of matches) {
    toReturn.push(match[0]);
  }

  return toReturn;
};

const getURLDirectoryServer = (urlString) => {
  const url = new URL(urlString);
  const pathParts = url.pathname.split("/").filter(Boolean); // ['business', 'api']
  pathParts.pop(); // Remove 'api'

  const newPath = "/" + pathParts.join("/"); // '/business'
  return `${url.origin}${newPath}`; // 'http://something.com/business'
};

const subsequentRequests = async (url, urlsFile, threads, output, js_urls) => {
  max_queue = threads;
  let staticJSURLs = [];

  console.log(chalk.cyan(`[i] Fetching JS files from subsequent requests`));

  // open the urls file, and load the paths (JSON)
  const endpoints = JSON.parse(fs.readFileSync(urlsFile, "utf-8")).paths;

  let js_contents = {};

  // make requests to all of them with the special header
  const reqPromises = endpoints.map(async (endpoint) => {
    const reqUrl = url + endpoint;
    try {
      // delay in case over the thread count
      while (queue >= max_queue) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      queue++;

      const res = await makeRequest(reqUrl, {
        headers: {
          RSC: "1",
        },
      });

      if (
        res &&
        res.status === 200 &&
        res.headers.get("content-type").includes("text/x-component")
      ) {
        const text = await res.text();
        js_contents[endpoint] = text;

        const { host, directory } = getURLDirectory(reqUrl);

        // save the contents to "___subsequent_requests/"
        // make the subsequent_requests directory if it doesn't exist

        const output_path = path.join(
          output,
          host,
          "___subsequent_requests",
          directory,
        );
        if (!fs.existsSync(output_path)) {
          fs.mkdirSync(output_path);
        }
        fs.writeFileSync(path.join(output_path, "index.js"), text);

        // find the static ones from the JS resp
        const staticFiles = await findStaticFiles(text);

        // go through each file and get the absolute path of those
        const absolutePaths = staticFiles.map((file) => {
          // go through existing JS URLs found
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
          return js_path_dir.replace("static/chunks", "") + file;
        });

        // Filter out paths that are already in js_urls before pushing to staticJSURLs
        const newPaths = absolutePaths.filter(path => !js_urls.includes(path));
        if (newPaths.length > 0) {
          staticJSURLs.push(...newPaths);
        }
      }

      queue--;
    } catch (e) {
      queue--;
      console.log(chalk.red(`[!] Error fetching ${reqUrl}: ${e}`));
    }
  });

  await Promise.all(reqPromises);

  staticJSURLs = [...new Set(staticJSURLs)];

  console.log(chalk.green(`[✓] Found ${staticJSURLs.length} JS chunks from subsequent requests`));

  return staticJSURLs;
};

export default subsequentRequests;
