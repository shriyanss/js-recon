import chalk from "chalk";

const commandHelpers = {
  fetchMenu: (chunks) => {
    let returnText = chalk.cyan(
      "List of chunks that contain fetch instances\n"
    );
    for (const chunk of Object.values(chunks)) {
      if (chunk.containsFetch) {
        returnText += chalk.green(
          `- ${chunk.id}: ${chunk.file} (${chunk.description})\n`
        );
      }
    }
    return returnText;
  },
  getFunctionCode: (chunks, funcName) => {
    let funcCode;
    for (const chunk of Object.values(chunks)) {
      if (chunk.id == funcName) {
        funcCode = chunk.code;
      }
    }
    if (!funcCode) {
      return chalk.red(`Function ${funcName} not found`);
    }
    return funcCode;
  },
  listAllFunctions: (chunks) => {
    let returnText = chalk.cyan("List of all functions\n");
    for (const chunk of Object.values(chunks)) {
      returnText += chalk.green(
        `- ${chunk.id}: ${chunk.description} (${chunk.file})\n`
      );
    }
    return returnText;
  },
  navHistory: (chunks, navList) => {
    let returnText = chalk.cyan("Navigation history\n");
    if (navList.length === 0) {
      returnText += chalk.yellow("- No navigation history");
    } else {
      for (const id of navList) {
        returnText += chalk.green(`- ${id}: ${chunks[id].description}\n`);
      }
    }
    return returnText;
  },
  traceFunction: (chunks, funcName) => {
    let returnText = chalk.cyan(`Tracing function ${funcName}\n`);
    const chunk = chunks[funcName];
    if (!chunk) {
      returnText += chalk.red(`Function ${funcName} not found`);
    } else {
      // get imports
      if (chunk.imports.length === 0) {
        returnText += chalk.yellow("- No imports");
      } else {
        returnText += chalk.greenBright("Imports:\n");
        for (const importName of chunk.imports) {
          const funcDesc = chunks[importName].description;
          returnText += chalk.green(`- ${importName}: ${funcDesc}\n`);
        }
      }
    }
    return returnText;
  },
};

export default commandHelpers;
