import fs from "fs";
import path from "path";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import chalk from "chalk";
const traverse = _traverse.default;

const client_jsFilesHref = async (directory) => {
  console.log(chalk.cyan("[i] Searching for `href` in the JS chunks"));
  let discoveredPaths = [];
  // index all the files in the directory
  let files;
  files = fs.readdirSync(directory, { recursive: true });

  // filter out the directories
  files = files.filter(
    (file) => !fs.statSync(path.join(directory, file)).isDirectory()
  );

  // filter out the subsequent requests files
  files = files.filter((file) => !file.startsWith("___subsequent_requests"));

  for (const file of files) {
    const code = fs.readFileSync(path.join(directory, file), "utf8");

    // parse the code with ast
    let ast;
    try {
      ast = parser.parse(code, {
        sourceType: "unambiguous",
        plugins: ["jsx", "typescript"],
      });

      traverse(ast, {
        ObjectExpression(path) {
          const properties = path.node.properties;
          let hasHref = false;
          let hrefValue = null;

          for (const prop of properties) {
            let prop_name = code.substring(prop.key.start, prop.key.end);
            let prop_val = code.substring(prop.value.start, prop.value.end);

            if (prop_name === "href") {
              // also, check if the href value matches the regex for path
              if (prop_val.match(/^"\/[\w\-]+.*"$/)) {
                hasHref = true;
                hrefValue = prop_val.replace(/^"|"$/g, "");
              } else if (prop_val.startsWith("\"http")) {
                hasHref = true;
                hrefValue = prop_val.replace(/^"|"$/g, "");
              }
            }
          }
          if (hasHref) {
            discoveredPaths.push(hrefValue);
          }
        },
      });
    } catch (err) {
      continue;
    }
  }

  return discoveredPaths;
};

export default client_jsFilesHref;
