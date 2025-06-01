import { program } from "commander";
import lazyload from "./lazyload/index.js";
import endpoints from "./endpoints/index.js";

program.version("0.0.1").description("JS Recon Tool");

program
  .command("lazyload")
  .description("Run lazy load module")
  .requiredOption("-u, --url <url>", "Target URL")
  .option("-o, --output <directory>", "Output directory", "output")
  .action(async (cmd) => {
    await lazyload(cmd.url, cmd.output);
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
