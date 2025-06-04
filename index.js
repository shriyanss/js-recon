import { program } from "commander";
import lazyLoad from "./lazyLoad/index.js";
import endpoints from "./endpoints/index.js";
import CONFIG from "./globalConfig.js";

program.version(CONFIG.version).description(CONFIG.toolDesc);

program
  .command("lazyload")
  .description("Run lazy load module")
  .requiredOption("-u, --url <url>", "Target URL")
  .option("-o, --output <directory>", "Output directory", "output")
  .action(async (cmd) => {
    await lazyLoad(cmd.url, cmd.output);
  });

program
  .command("endpoints")
  .description("Extract API endpoints")
  .requiredOption("-u, --url <url>", "Target URL")
  .option("-o, --output <file>", "Output file")
  .action((cmd) => {
    endpoints(cmd.url, cmd.output);
  });

program.parse(process.argv);
