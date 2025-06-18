import makeRequest from "../../utility/makeReq.js";
import * as cheerio from "cheerio";
import resolvePath from "../../utility/resolvePath.js";
import chalk from "chalk";
import { getJsUrls, pushToJsUrls } from "../globals.js";

const svelte_getFromPageSource = async (url) => {
  console.log(chalk.cyan("[i] Analyzing page source"));
  let foundUrls = [];
  const pageSource = await makeRequest(url);
  const body = await pageSource.text();

  // cheerio to parse the page source
  const $ = cheerio.load(body);

  // find all link tags
  const linkTags = $("link");

  for (const linkTag of linkTags) {
    const relAttr = $(linkTag).attr("rel");
    if (relAttr === "modulepreload") {
      const hrefAttr = $(linkTag).attr("href");
      if (hrefAttr) {
        foundUrls.push(await resolvePath(url, hrefAttr));
      }
    }
  }

  if (foundUrls.length === 0) {
    console.log(chalk.red("[!] No JS files found from the page source"));
    return [];
  } else {
    console.log(
      chalk.green(
        `[✓] Found ${foundUrls.length} JS files from the page source`,
      ),
    );
  }

  // iterate through the foundUrls and resolve the paths
  for (const foundUrl of foundUrls) {
    const resolvedPath = await resolvePath(url, foundUrl);
    if (getJsUrls().includes(resolvedPath)) {
      continue;
    }
    pushToJsUrls(resolvedPath);
  }

  return foundUrls;
};
export default svelte_getFromPageSource;
