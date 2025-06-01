const { program } = require("commander");
const lazyLoad = require("./lazyload").default;
const endpoints = require("./endpoints").default;

program.version("0.0.1").description("JS Recon Tool");

program
  .command("lazyload")
  .description("Run lazy load module")
  .requiredOption("-u, --url <url>", "Target URL")
  .option("-o, --output <file>", "Output file")
  .action((cmd) => {
    lazyLoad(cmd.url, cmd.output);
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
