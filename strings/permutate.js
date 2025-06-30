import chalk from "chalk";
import fs from "fs";

const permutate = async (urls, paths, output) => {
  console.log(chalk.cyan("[i] Permutating URLs and paths"));

  let permutedUrls = [];

  //   go through each URL
  for (const url of urls) {
    // check if the URL is valid or not by passing to URL
    try {
      new URL(url);
    } catch (err) {
      continue;
    }

    // now that's a valid URL, get the base URL from it
    const baseUrl = new URL(url).origin;

    // go through each path
    for (const path of paths) {
      // join the baseurl and the path, and push it to an array
      permutedUrls.push(new URL(path, baseUrl).href);
    }
  }

  // write to a .txt file
  const results = permutedUrls.join("\n");
  fs.writeFileSync(`${output}.txt`, results);

  console.log(chalk.green(`[✓] Written permuted URLs to ${output}.txt`));
};

export default permutate;
