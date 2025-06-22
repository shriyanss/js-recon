import chalk from "chalk";
import fs from "fs";
import path from "path";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;

const client_subsequentRequests = async (subsequentRequestsDir) => {
  console.log(chalk.cyan("[i] Using subsequent requests file method"));

  // get all the files in the directory
  const walkSync = (dir, files = []) => {
    fs.readdirSync(dir).forEach((file) => {
      let dirFile = path.join(dir, file);
      if (fs.statSync(dirFile).isDirectory()) {
        walkSync(dirFile, files);
      } else {
        files.push(dirFile);
      }
    });
    return files;
  };
  const files = walkSync(subsequentRequestsDir);
  console.log(chalk.green(`[✓] Found ${files.length} files`));

  // open each file and read the contents
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");

    // go through each line
    const lines = content.split("\n");
    for (const line of lines) {
      // check what is the type of line's content by matching it against regex
      if (line.match(/^[0-9a-z]+:I\[.+/)) {
        // console.log("JS Chunks");
        continue;
        // } else if (line.match(/^[0-9a-z\s\.]+:([A-Za-z0-9\,\.\s\-]+:)?[\[\{].+/)) {
      } else if (line.match(/^[0-9a-z]+:\[.+/)) {
        // extract the JS code. i.e. between [ and ]
        const jsCode = `[${line.match(/\[(.+)\]/)[1]}]`;
        // console.log(jsCode);

        // parse JS code with ast
        let ast;
        try {
            ast = parser.parse(jsCode, {
            sourceType: "unambiguous",
            plugins: ["jsx", "typescript"],
          });
        } catch (err) {
          continue;
        }

        // traverse the ast, and find the objects with href, and external
        let finds = [];
        traverse(ast, {
          ObjectExpression(path) {
            const properties = path.node.properties;
            let hasHrefOrUrl = false;
            let hasExternal = false;
            let hrefValue = null;
            let externalValue = null;
            
            for (const prop of properties) {
              const prop_name = jsCode.substring(prop.key.start, prop.key.end);
              if (prop_name === "\"href\"") {
                hasHrefOrUrl = true;
                hrefValue = jsCode.substring(prop.value.start, prop.value.end).replace(/^"|"$/g, "");
              }
              if (prop_name === "\"external\"") {
                hasExternal = true;
                externalValue = jsCode.substring(prop.value.start, prop.value.end).replace(/^"|"$/g, "");
              }
            }
            
            if (hasHrefOrUrl && hasExternal) {
              finds.push({ href: hrefValue, external: externalValue });
            }
          }
        });

        // iterate through the finds and resolve the paths
        for (const find of finds) {
          console.log(find);
        }
      } else {
        // console.log("Unknown");
        // console.log(line);
        continue;
      }
    }
  }
};

export default client_subsequentRequests;
