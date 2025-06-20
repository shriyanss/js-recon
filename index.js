#!/usr/bin/env node
import { program } from "commander";
import lazyLoad from "./lazyLoad/index.js";
import endpoints from "./endpoints/index.js";
import CONFIG from "./globalConfig.js";
import strings from "./strings/index.js";
import apiGateway from "./api_gateway/index.js";
import * as globals from "./utility/globals.js";

program.version(CONFIG.version).description(CONFIG.toolDesc);

program
  .command("lazyload")
  .description("Run lazy load module")
  .requiredOption("-u, --url <url/file>", "Target URL or a file containing a list of URLs (one per line)")
  .option("-o, --output <directory>", "Output directory", "output")
  .option("--strict-scope", "Download JS files from only the input URL domain", false)
  .option("-s, --scope <scope>", "Download JS files from specific domains (comma-separated)", "*")
  .option("-t, --threads <threads>", "Number of threads to use", 1)
  .option("--subsequent-requests", "Download JS files from subsequent requests", false)
  .option("--urls-file <file>", "Input JSON file containing URLs", "extracted_urls.json")
  .option("--api-gateway", "Generate requests using API Gateway", false)
  .option("--api-gateway-config <file>", "API Gateway config file", ".api_gateway_config.json")
  .option("--cache-file <file>", "File to contain response cache", ".resp_cache.json")
  .option("--disable-cache", "Disable response caching", false)
  .option("-y, --yes", "Auto-approve executing JS code from the target", false)
  .action(async (cmd) => {
    globals.setApiGatewayConfigFile(cmd.apiGatewayConfig);
    globals.setUseApiGateway(cmd.apiGateway);
    globals.setDisableCache(cmd.disableCache);
    globals.setRespCacheFile(cmd.cacheFile);
    globals.setYes(cmd.yes);
    await lazyLoad(cmd.url, cmd.output, cmd.strictScope, cmd.scope.split(","), cmd.threads, cmd.subsequentRequests, cmd.urlsFile);
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
  .option("-o, --output <file>", "JSON file to save the strings", "strings.json")
  .option("-e, --extract-urls", "Extract URLs from strings", false)
  .option("--extracted-url-path <file>", "Output JSON file for extracted URLs and paths", "extracted_urls.json")
  .option("-s, --scan-secrets", "Scan for secrets", false)
  .action((cmd) => {
    strings(cmd.directory, cmd.output, cmd.extractUrls, cmd.extractedUrlPath, cmd.scanSecrets);
  });

program
  .command("api-gateway")
  .description("Configure AWS API Gateway to rotate IP addresses")
  .option("-i, --init", "Initialize the config file (create API)", false)
  .option("-d, --destroy <id>", "Destroy API with the given ID")
  .option("--destroy-all", "Destroy all the API created by this tool in all regions", false)
  .option("-r, --region <region>", "AWS region (default: random region)")
  .option("-a, --access-key <access-key>", "AWS access key (if not provided, AWS_ACCESS_KEY_ID environment variable will be used)")
  .option("-s, --secret-key <secret-key>", "AWS secret key (if not provided, AWS_SECRET_ACCESS_KEY environment variable will be used)")
  .option("-c, --config <config>", "Name of the config file", ".api_gateway_config.json")
  .option("-l, --list", "List all the API created by this tool", false)
  .option("--feasibility", "Check feasibility of API Gateway", false)
  .option("--feasibility-url <url>", "URL to check feasibility of")
  .action((cmd) => {
    globals.setApiGatewayConfigFile(cmd.config);
    globals.setUseApiGateway(true);
    apiGateway(cmd.init, cmd.destroy, cmd.destroyAll, cmd.list, cmd.region, cmd.accessKey, cmd.secretKey, cmd.config, cmd.feasibility, cmd.feasibilityUrl);
});

program.parse(process.argv);
