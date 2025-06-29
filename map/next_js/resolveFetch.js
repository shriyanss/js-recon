import chalk from "chalk";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;

const resolveFetch = async (chunks, output, formats) => {
  console.log(chalk.cyan("[i] Resolving fetch instances"));

  // iterate through the chunks, and resolve fetch
  for (const chunk of chunks) {
    // first, check if it has fetch
    if (!chunk.containsFetch) {
      continue;
    }

    // load the chunk code in ast
    let ast;
    try {
      ast = parser.parse(chunk.code, {
        sourceType: "module",
        plugins: ["jsx", "typescript"],
      });
    } catch (err) {
      continue;
    }

    // now, traverse the ast
    traverse(ast, {
      CallExpression(path) {
        if (path.node.callee.name === "fetch") {
          chunk.containsFetch = true;
        }
      },
    });
  }
};

export default resolveFetch;
