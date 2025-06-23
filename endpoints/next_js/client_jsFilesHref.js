import fs from "fs";
import path from "path";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import chalk from "chalk";
const traverse = _traverse.default;

const client_jsFilesHref = async (directory) => {
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

  console.log(chalk.cyan(`[i] Iterating over ${files.length} files`));

  for (const file of files) {
    const code = fs.readFileSync(path.join(directory, file), "utf8");

    // parse the code with ast
    let ast;
    try {
      ast = parser.parse(code, {
        sourceType: "unambiguous",
        plugins: ["jsx", "typescript"],
      });

      let finds = [];

      traverse(ast, {
        ObjectExpression(path) {
          const properties = path.node.properties;
          let hasHrefOrUrl = false;
          let hasActive = false;
          let hrefValue = null;

          for (const prop of properties) {
            let prop_name = code.substring(prop.key.start, prop.key.end);
            let prop_val = code.substring(prop.value.start, prop.value.end);

            if (prop_name === "href") {
              hasHrefOrUrl = true;
              hrefValue = prop_val.replace(/^"|"$/g, "");
            }
            if (hasHrefOrUrl && prop_name.includes("label")) {
              hasActive = true;
            }
             if (hasHrefOrUrl && hasActive) {
              finds.push({ href: hrefValue });
            }
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
