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
        const ast = parser.parse(jsCode, {
          sourceType: "unambiguous",
          plugins: ["jsx", "typescript"],
        });

        // traverse the ast, and find the objects with href, and external
        let finds = [];
        try {
          traverse(ast, {
            ObjectExpression(path) {
              const href = path.node.properties.find(
                (prop) => prop.key.name === "href"
              );
              const external = path.node.properties.find(
                (prop) => prop.key.name === "external"
              );
              if (href && external) {
                finds.push({
                  href: href.value.value,
                  external: external.value.value,
                });
              }
            },
          });
        } catch (error) {
          console.log(error);
        }
        console.log(finds);
      } else {
        // console.log("Unknown");
        // console.log(line);
        continue;
      }
    }
  }
};

export default client_subsequentRequests;
