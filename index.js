import { program } from "commander";
import lazyLoad from "./lazyLoad/index.js";
import endpoints from "./endpoints/index.js";
import CONFIG from "./globalConfig.js";
import strings from "./strings/index.js";

program.version(CONFIG.version).description(CONFIG.toolDesc);

program
  .command("lazyload")
  .description("Run lazy load module")
  .requiredOption("-u, --url <url/file>", "Target URL or a file containing a list of URLs (one per line)")
  .option("-o, --output <directory>", "Output directory", "output")
  .option("--strict-scope", "Download JS files from only the input URL domain", false)
  .option("-s, --scope <scope>", "Download JS files from specific domains (comma-separated)", "*")
  .option("-t, --threads <threads>", "Number of threads to use", 1)
  .action(async (cmd) => {
    await lazyLoad(cmd.url, cmd.output, cmd.strictScope, cmd.scope.split(","), cmd.threads);
  });

program
  .command("endpoints")
  .description("Extract API endpoints")
  .requiredOption("-u, --url <url>", "Target URL")
  .option("-o, --output <file>", "Output file")
  .action((cmd) => {
    endpoints(cmd.url, cmd.output);
  });

program
  .command("strings")
  .description("Extract strings from JS files")
  .requiredOption("-d, --directory <directory>", "Directory containing JS files")
  .action((cmd) => {
    strings(cmd.directory);
  });

program.parse(process.argv);
