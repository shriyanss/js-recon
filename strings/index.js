import chalk from "chalk";
import fs from "fs";
import path from "path";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import prettier from "prettier";
import secrets from "./secrets.js";

const traverse = _traverse.default;

/**
 * Extracts all string literals from all .js files in a given directory and its
 * subdirectories and writes them to a JSON file.
 * @param {string} directory - The directory to scan for .js files
 * @param {string} output_file - The file to write the extracted strings to
 */
const strings = async (
  directory,
  output_file,
  extract_urls,
  extracted_url_path,
  scan_secrets,
) => {
  console.log(chalk.cyan("[i] Loading 'Strings' module"));

  // check if the directory exists
  if (!fs.existsSync(directory)) {
    console.log(chalk.red("[!] Directory does not exist"));
    return;
  }

  console.log(chalk.cyan(`[i] Scanning ${directory} directory`));

  // get all files in the directory and sub-directories
  const files = fs.readdirSync(directory, { recursive: true });

  // filter out non JS files
  let jsFiles = files.filter((file) => file.endsWith(".js"));

  // filter out subsequent requests files
  jsFiles = jsFiles.filter((file) => !file.startsWith("___subsequent_requests"));

  // read all JS files
  let js_files_path = [];
  for (const file of jsFiles) {
    const filePath = path.join(directory, file);
    if (!fs.lstatSync(filePath).isDirectory()) {
      js_files_path.push(filePath);
    }
  }

  console.log(chalk.cyan(`[i] Found ${js_files_path.length} JS files`));

  // read all JS files
  let all_strings = {};
  for (const file of js_files_path) {
    const fileContent = fs.readFileSync(file, "utf-8");

    // parse the file contents with babel
    const ast = parser.parse(fileContent, {
      sourceType: "unambiguous",
      plugins: ["jsx", "typescript"],
    });

    let strings = [];

    traverse(ast, {
      StringLiteral(path) {
        strings.push(path.node.value);
      },
    });

    all_strings[file] = strings;
  }

  let strings_count = 0;
  for (const file of Object.keys(all_strings)) {
    strings_count += all_strings[file].length;
  }

  console.log(chalk.cyan(`[i] Extracted ${strings_count} strings`));

  // write to a JSON file
  const formatted = await prettier.format(JSON.stringify(all_strings), {
    parser: "json",
    printWidth: 80,
    singleQuote: true,
  });
  fs.writeFileSync(output_file, formatted);

  console.log(chalk.green(`[✓] Extracted strings to ${output_file}`));

  // if the -e flag is enabled, extract the URLs also
  if (extract_urls) {
    console.log(chalk.cyan("[i] Extracting URLs and paths from strings"));

    let urls = [];
    let paths = [];

    for (const file of Object.keys(all_strings)) {
      for (const string of all_strings[file]) {
        if (string.match(/^https?:\/\/[a-zA-Z0-9\.\-_]+\/?.*$/)) {
          // like https://site.com
          urls.push(string);
        }
        if (string.match(/^\/.+$/)) {
          // like /path/resource
          // make sure that the path doesn't start with two special chars except '/_'
          if (string.match(/^\/[^a-zA-Z0-9]/) && !string.startsWith("/_")) {
            // ignore the path
          } else {
            paths.push(string);
          }
        }
        if (string.match(/^[a-zA-Z0-9_\-]\/[a-zA-Z0-9_\-].*$/)) {
          // like path/to/resource
          paths.push(string);
        }
        if (string.startsWith("./") || string.startsWith("../")) {
          // like "./path/to/resource" or "../path/to/resource"
          paths.push(string);
        }
      }
    }

    // dedupe the two lists
    urls = [...new Set(urls)];
    paths = [...new Set(paths)];

    console.log(
      chalk.cyan(`[i] Found ${urls.length} URLs and ${paths.length} paths`),
    );

    // write to a JSON file
    const formatted_urls = await prettier.format(
      JSON.stringify({ urls, paths }),
      {
        parser: "json",
        printWidth: 80,
        singleQuote: true,
      },
    );
    fs.writeFileSync(extracted_url_path, formatted_urls);

    console.log(
      chalk.green(`[✓] Written URLs and paths to ${extracted_url_path}`),
    );
  }

  if (scan_secrets) {
    console.log(chalk.cyan("[i] Scanning for secrets"));

    let total_secrets = 0;

    for (const file of js_files_path) {
      const fileContent = fs.readFileSync(file, "utf8");
      const foundSecrets = await secrets(fileContent);
      if (foundSecrets.length > 0) {
        for (const foundSecret of foundSecrets) {
          console.log(chalk.green(`[✓] Found ${foundSecret.name} in ${file}`));
          console.log(chalk.bgGreen(foundSecret.value));
          total_secrets++;
        }
      }
    }

    if (total_secrets === 0) {
      console.log(chalk.yellow(`[!] No secrets found`));
    } else {
      console.log(chalk.green(`[✓] Found ${total_secrets} secrets`));
    }
  }
};

export default strings;
