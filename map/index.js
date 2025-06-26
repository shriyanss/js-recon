import chalk from "chalk";
import fs from "fs";
import path from "path";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;

const availableTech = {
  next: "Next.JS",
};

const map = async (directory, output, format, tech, list) => {
  console.log(chalk.cyan("[i] Running 'map' module"));

  if (list) {
    console.log(chalk.cyan("Available technologies:"));
    for (const [key, value] of Object.entries(availableTech)) {
      console.log(chalk.cyan(`- '${key}': ${value}`));
    }
    return;
  }

  if (!tech) {
    console.log(chalk.red("[!] Please specify a technology with -t/--tech. Run with -l/--list to see available technologies"));
    return;
  }

  if (!directory) {
    console.log(
      chalk.red("[!] Please specify a directory with -d/--directory")
    );
    return;
  }

  // list all the files in the directory
  let files = fs.readdirSync(directory, { recursive: true });

  // remove all subsequent requests file from the list
  files = files.filter((file) => {
    return !file.includes("___subsequent_requests");
  });

  // remove all directories from the list
  files = files.filter((file) => {
    return !fs.lstatSync(path.join(directory, file)).isDirectory();
  });

  // read each file
  for (const file of files) {
    // if the first three lines of the file doesn't contain `self.webpackChunk_N_E`, continue
    const firstThreeLines = fs.readFileSync(path.join(directory, file), "utf8").split("\n").slice(0, 3);
    if (!firstThreeLines.some((line) => line.includes("self.webpackChunk_N_E"))) {
      continue;
    }

    // read the file
    const code = fs.readFileSync(path.join(directory, file), "utf8");

    // parse the code with ast
    let ast;
    try {
      ast = parser.parse(code, {
        sourceType: "unambiguous",
        plugins: ["jsx", "typescript"],
      });
    } catch (err) {
      continue;
    }

    let chunks = [];

    // traverse the ast
    traverse(ast, {

    });
  }
};

export default map;
