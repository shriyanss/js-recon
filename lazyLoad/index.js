import chalk from "chalk";
import path from "path";
import fs from "fs";
import frameworkDetect from "../techDetect/index.js";
import puppeteer from "puppeteer";
import CONFIG from "../globalConfig.js";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;
import inquirer from "inquirer";
import { VM } from "vm2";
import prettier from "prettier";

const getResources = async (url) => {
  const browser = await puppeteer.launch({
    headless: true,
  });

  const page = await browser.newPage();

  await page.setRequestInterception(true);

  let js_urls = [];

  page.on("request", async (request) => {
    // get the request url
    const url = request.url();

    // see if the request is a JS file, and is a get request
    if (
      request.method() === "GET" &&
      url.match(/https?:\/\/[a-z\._\-]+\/.+\.js\??.*/)
    ) {
      js_urls.push(url);
    }

    await request.continue();
  });

  await page.goto(url);

  await browser.close();

  let webpack_js;

  // iterate through JS files
  for (const js_url of js_urls) {
    // match for webpack js file
    if (js_url.match(/\/webpack.*\.js/)) {
      console.log(chalk.green(`[✓] Found webpack JS file at ${js_url}`));
      webpack_js = js_url;
    }
  }

  if (!webpack_js) {
    console.log(chalk.red("[!] No webpack JS file found"));
    console.log(chalk.magenta(CONFIG.notFoundMessage));
    return;
  }

  // parse the webpack JS file
  const res = await fetch(webpack_js);
  const webpack_js_source = await res.text();

  // parse it with @babel/*
  const ast = parser.parse(webpack_js_source, {
    sourceType: "unambiguous",
    plugins: ["jsx", "typescript"],
  });

  let functions = [];

  traverse(ast, {
    FunctionDeclaration(path) {
      functions.push({
        name: path.node.id?.name || "(anonymous)",
        type: "FunctionDeclaration",
        source: webpack_js_source.slice(path.node.start, path.node.end),
      });
    },
    FunctionExpression(path) {
      functions.push({
        name: path.parent.id?.name || "(anonymous)",
        type: "FunctionExpression",
        source: webpack_js_source.slice(path.node.start, path.node.end),
      });
    },
    ArrowFunctionExpression(path) {
      functions.push({
        name: path.parent.id?.name || "(anonymous)",
        type: "ArrowFunctionExpression",
        source: webpack_js_source.slice(path.node.start, path.node.end),
      });
    },
    ObjectMethod(path) {
      functions.push({
        name: path.node.key.name,
        type: "ObjectMethod",
        source: webpack_js_source.slice(path.node.start, path.node.end),
      });
    },
    ClassMethod(path) {
      functions.push({
        name: path.node.key.name,
        type: "ClassMethod",
        source: webpack_js_source.slice(path.node.start, path.node.end),
      });
    },
  });

  let user_verified = false;
  // method 1
  // iterate through the functions, and find out which one ends with `".js"`

  let final_Func;
  for (const func of functions) {
    if (func.source.match(/\".js"$/)) {
      console.log(
        chalk.green(`[✓] Found JS chunk having the following source`)
      );
      console.log(chalk.yellow(func.source));
      final_Func = func.source;
    }
  }

  //   ask through input if this is the right thing
  const askCorrectFuncConfirmation = async () => {
    const { confirmed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmed",
        message: "Is this the correct function?",
        default: true,
      },
    ]);
    return confirmed;
  };

  user_verified = await askCorrectFuncConfirmation();
  if (user_verified == true) {
    console.log(
      chalk.green("[✓] Proceeding with the selected function to fetch files")
    );
  }

  const urlBuilderFunc = `(() => (${final_Func}))()`;

  const vm = new VM({
    timeout: 2000,
    sandbox: {},
  });
  
  let js_paths = [];
  try {
    const func = vm.run(urlBuilderFunc);

    // iterate through all integers, till 1000000, and get the output
    for (let i = 0; i < 1000000; i++) {
      const output = func(i);
      if (output.includes("undefined")) {
        continue;
      } else {
        js_paths.push(output);
      }
    }
  } catch (err) {
    console.error("Unsafe or invalid code:", err.message);
    return
  }

  if (js_paths.length > 0) {
    console.log(chalk.green(`[✓] Found ${js_paths.length} JS chunks`));
  }

  // build final URL
  let final_urls = [];
  for (let i = 0; i < js_paths.length; i++) {
    // get the directory of webpack file
    const webpack_dir = webpack_js.split("/").slice(0, -1).join("/");
    // replace the filename from the js path
    const js_path_dir = js_paths[i].replace(/\/[a-zA-Z0-9\.]+\.js.*$/, "");
    const final_url = webpack_dir.replace(js_path_dir, js_paths[i]);
    final_urls.push(final_url);
  }

  return final_urls;
};

const downloadFiles = async (urls, output) => {
  console.log(chalk.cyan(`[i] Downloading JS chunks`));
  fs.mkdirSync(output, { recursive: true });

  const downloadPromises = urls.map(async (url) => {
    try {
      if (url.endsWith(".js")) {
        const res = await fetch(url);
        const file = await res.text();
        const filename = url.split("/").pop();
        const filePath = path.join(output, filename);
        fs.writeFileSync(filePath, await prettier.format(file, { parser: "babel" }));
      }
    } catch (err) {
      console.error(chalk.red(`[!] Failed to download: ${url}`), err.message);
    }
  });

  await Promise.all(downloadPromises);


  console.log(chalk.green(`[✓] Downloaded JS chunks to ${output} directory`));
};

const lazyload = async (url, output) => {
  console.log(chalk.cyan("[i] Loading 'Lazy Load' module"));

  const tech = await frameworkDetect(url);

  if (tech !== null) {
    if (tech.name === "next") {
      console.log(chalk.green("[✓] Next.js detected"));
      console.log(chalk.yellow(`Evidence: ${tech.evidence}`));

      // get the resources
      const resources = await getResources(url);

      // download the resources
      await downloadFiles(resources, output);
    }
  } else {
    console.log(chalk.red("[!] Framework not detected :("));
    console.log(chalk.magenta(CONFIG.notFoundMessage));
    return;
  }
};

export default lazyload;
