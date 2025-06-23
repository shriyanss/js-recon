import fs from "fs";
import chalk from "chalk";
import resolvePath from "../../utility/resolvePath.js";

const iterate_n_store = async (baseUrl, urls) => {
  let result = {};
  for (let url of urls) {
    if (url.startsWith("mailto:") || url.startsWith("tel:")) {
      continue;
    }

    if (url.startsWith("/")) {
      url = await resolvePath(baseUrl, url);
    }

    // Parse the URL once and extract the bits we need
    const { origin, pathname } = new URL(url);

    // Ensure we have a container object for this origin
    if (!result[origin]) {
      result[origin] = {};
    }

    // Always insert the root path for this origin
    if (!result[origin]["/"]) {
      result[origin]["/"] = {};
    }

    // Normalise the pathname – strip leading/trailing slashes and split into segments
    const segments =
      pathname === "/" ? [] : pathname.replace(/^\/|\/$/g, "").split("/");

    let cumulativePath = ""; // will build up like "/app", "/app/dashboard"
    let currentNode = result[origin];

    for (const segment of segments) {
      cumulativePath += `/${segment}`;
      if (!currentNode[cumulativePath]) {
        currentNode[cumulativePath] = {};
      }
      // descend into the newly created / already existing child
      currentNode = currentNode[cumulativePath];
    }
  }

  return result;
};

const gen_json = async (url, hrefs, output) => {
  // iterate over hrefs
  const result = await iterate_n_store(url, hrefs);

  const finalJSON = JSON.stringify(result, null, 2);
  fs.writeFileSync(`${output}.json`, finalJSON);

  console.log(chalk.green(`[✓] Generated JSON report at ${output}.json`));
  return finalJSON;
};

export default gen_json;
