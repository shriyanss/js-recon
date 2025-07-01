import fs from "fs";
import path from "path";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;
import chalk from "chalk";

import * as globals from "../../utility/globals.js";
import OpenAI from "openai";

const getWebpackConnections = async (directory, output, formats) => {
  // if openai is enabled, then create a client
  let openaiClient;
  if (globals.getAi() != []) {
    // print a warning message about costs that might incur
    console.log(chalk.yellow("[!] OpenAI integration is enabled. This may incur costs. By using this feature, you agree to the OpenAI terms of service, and accept the risk of incurring unexpected costs due to huge codebase."));
    const apiKey =
      globals.getOpenaiApiKey() || process.env.OPENAI_API_KEY || undefined;
    if (!apiKey) {
      console.log(chalk.red("[!] OpenAI API key not found"));
      process.exit(1);
    }
    openaiClient = new OpenAI({
      apiKey: apiKey,
    });
    console.log(chalk.cyan("[i] OpenAI Client created"));
  }

  console.log(chalk.cyan("[i] Getting webpack connections"));
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

  let chunks = {};

  // read all the files, and get the chunks
  for (const file of files) {
    // if the first three lines of the file doesn't contain `self.webpackChunk_N_E`, continue
    const firstThreeLines = fs
      .readFileSync(path.join(directory, file), "utf8")
      .split("\n")
      .slice(0, 3);
    if (
      !firstThreeLines.some((line) => line.includes("self.webpackChunk_N_E"))
    ) {
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

    // traverse the ast
    traverse(ast, {
      CallExpression(path) {
        const callee = path.get("callee");

        // check if the call expression is a push to a webpack chunk
        if (
          !callee.isMemberExpression() ||
          !callee.get("property").isIdentifier({ name: "push" })
        ) {
          return;
        }

        let object = callee.get("object");
        if (object.isAssignmentExpression()) {
          object = object.get("left");
        }

        if (
          !(
            object.isMemberExpression() &&
            object.get("property").isIdentifier() &&
            object.get("property").node.name.startsWith("webpackChunk")
          )
        ) {
          return;
        }

        // get the first argument of the push call
        const arg = path.get("arguments.0");
        if (!arg || !arg.isArrayExpression()) {
          return;
        }

        // find the object expression in the arguments
        const elements = arg.get("elements");
        for (const element of elements) {
          if (element.isObjectExpression()) {
            const properties = element.get("properties");
            for (const prop of properties) {
              if (prop.isObjectProperty()) {
                const key = prop.get("key");
                if (key.isNumericLiteral() || key.isStringLiteral()) {
                  const keyValue = key.node.value;
                  const function_code = code
                    .slice(prop.node.start, prop.node.end)
                    .replace(
                      /^\s*[\w\d]+:\s+function\s+/,
                      `function webpack_${keyValue} `
                    )
                    .replace(/^s*[\w\d]+:\s\(/, `func_${keyValue} = (`);
                  chunks[keyValue] = {
                    id: keyValue,
                    description: "none",
                    loadedOn: [],
                    containsFetch: false,
                    exports: "string",
                    callStack: [],
                    code: function_code,
                    connections: [],
                    file: file,
                  };
                }
              }
            }
          }
        }
      },
    });
  }

  // now, iterate through every chunk, and find the connections
  console.log(chalk.cyan("[i] Finding connections for chunks"));
  for (const [key, value] of Object.entries(chunks)) {
    let ast;
    try {
      ast = parser.parse(value.code, {
        sourceType: "unambiguous",
        plugins: ["jsx", "typescript"],
      });
    } catch (err) {
      continue;
    }

    // if the function has three arguments, get the name of the third argument
    let thirdArgName;
    traverse(ast, {
      FunctionDeclaration(path) {
        const args = path.get("params");
        if (args.length === 3) {
          thirdArgName = args[2].node.name;
        }
      },
    });

    // if the function doesn't have three arguments, continue
    if (!thirdArgName) {
      continue;
    }

    // if the thirs argument, i.e. __webpack_require__ is present, then see if it is used
    // if yes, print the chunk name
    traverse(ast, {
      CallExpression(path) {
        const callee = path.get("callee");
        if (callee.isIdentifier({ name: thirdArgName })) {
          // the id of the function
          const id = path.get("arguments.0");
          if (id) {
            if (
              id.node.value !== undefined &&
              String(id.node.value).match(/^\d+$/) &&
              id.node.value !== ""
            ) {
              chunks[key].connections.push(String(id.node.value));
            }
          }
        }
      },
    });
  }

  // if description is enabled, add them
  if (globals.getAi() && globals.getAi().includes("description")) {
    console.log(chalk.cyan("[i] Generating descriptions for chunks"));
    const chunkEntries = Object.entries(chunks);
    const descriptionPromises = chunkEntries.map(([_, value]) =>
      openaiClient.responses.create({
        model: globals.getAiModel(),
        input: [
          {
            role: "system",
            content:
              "You are a code analyzer. You will be given a function from the webpack of a compiled Next.JS file. You have to generate a one-liner description of what the function does.",
          },
          {
            role: "user",
            content: value.code,
          },
        ],
        temperature: 0.1,
        max_output_tokens: 1000,
      })
    );

    const descriptions = await Promise.all(descriptionPromises);

    descriptions.forEach((desc, index) => {
      const [key] = chunkEntries[index];
      chunks[key].description = desc.output[0].content[0].text;
      console.log(
        chalk.green(`[✓] Generated description for ${key}: ${chunks[key].description}`)
      );
    });
  }

  console.log(
    chalk.green(`[✓] Found ${Object.keys(chunks).length} webpack functions`)
  );

  if (formats.includes("json")) {
    const chunks_json = JSON.stringify(chunks, null, 2);
    fs.writeFileSync(`${output}.json`, chunks_json);
    console.log(chalk.green(`[✓] Saved webpack connections to ${output}.json`));
  }

  return chunks;
};

export default getWebpackConnections;
