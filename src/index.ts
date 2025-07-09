#!/usr/bin/env node
import { program } from "commander";
import lazyLoad from "./lazyLoad/index.js";
import endpoints from "./endpoints/index.js";
import CONFIG from "./globalConfig.js";
import strings from "./strings/index.js";
import apiGateway from "./api_gateway/index.js";
import map from "./map/index.js";
import * as globalsUtil from "./utility/globals.js";
import run from "./run/index.js";
import chalk from "chalk";

program.version(CONFIG.version).description(CONFIG.toolDesc);
const validAiOptions = ["description"];

program
    .command("lazyload")
    .description("Run lazy load module")
    .requiredOption(
        "-u, --url <url/file>",
        "Target URL or a file containing a list of URLs (one per line)"
    )
    .option("-o, --output <directory>", "Output directory", "output")
    .option(
        "--strict-scope",
        "Download JS files from only the input URL domain",
        false
    )
    .option(
        "-s, --scope <scope>",
        "Download JS files from specific domains (comma-separated)",
        "*"
    )
    .option("-t, --threads <threads>", "Number of threads to use", "1")
    .option(
        "--subsequent-requests",
        "Download JS files from subsequent requests (Next.JS only)",
        false
    )
    .option(
        "--urls-file <file>",
        "Input JSON file containing URLs",
        "extracted_urls.json"
    )
    .option("--api-gateway", "Generate requests using API Gateway", false)
    .option(
        "--api-gateway-config <file>",
        "API Gateway config file",
        ".api_gateway_config.json"
    )
    .option(
        "--cache-file <file>",
        "File to store response cache",
        ".resp_cache.json"
    )
    .option("--disable-cache", "Disable response caching", false)
    .option(
        "-y, --yes",
        "Auto-approve executing JS code from the target",
        false
    )
    .action(async (cmd) => {
        globalsUtil.setApiGatewayConfigFile(cmd.apiGatewayConfig);
        globalsUtil.setUseApiGateway(cmd.apiGateway);
        globalsUtil.setDisableCache(cmd.disableCache);
        globalsUtil.setRespCacheFile(cmd.cacheFile);
        globalsUtil.setYes(cmd.yes);
        await lazyLoad(
            cmd.url,
            cmd.output,
            cmd.strictScope,
            cmd.scope.split(","),
            Number(cmd.threads),
            cmd.subsequentRequests,
            cmd.urlsFile
        );
    });

program
    .command("endpoints")
    .description("Extract API endpoints")
    .option(
        "-u, --url <url>",
        "Target Base URL (will be used to resolve relative paths)"
    )
    .option("-d, --directory <directory>", "Directory containing JS files")
    .option(
        "-o, --output <filename>",
        "Output filename (without file extension)",
        "endpoints"
    )
    .option(
        "--output-format <format>",
        "Output format for the results comma-separated (available: json, md)",
        "json"
    )
    .option(
        "-t, --tech <tech>",
        "Technology used in the JS files (run with -l/--list to see available options)"
    )
    .option("-l, --list", "List available technologies", false)
    .option(
        "--subsequent-requests-dir <directory>",
        "Directory containing subsequent requests (for Next.JS)"
    )
    .action(async (cmd) => {
        await endpoints(
            cmd.url,
            cmd.directory,
            cmd.output,
            cmd.outputFormat.split(","),
            cmd.tech,
            cmd.list,
            cmd.subsequentRequestsDir
        );
    });

program
    .command("strings")
    .description("Extract strings from JS files")
    .requiredOption(
        "-d, --directory <directory>",
        "Directory containing JS files"
    )
    .option(
        "-o, --output <file>",
        "JSON file to save the strings",
        "strings.json"
    )
    .option("-e, --extract-urls", "Extract URLs from strings", false)
    .option(
        "--extracted-url-path <file>",
        "Output file for extracted URLs and paths (without extension)",
        "extracted_urls"
    )
    .option("-p, --permutate", "Permutate URLs and paths found", false)
    .option(
        "--openapi",
        "Generate OpenAPI specification from the paths found",
        false
    )
    .option("-s, --scan-secrets", "Scan for secrets", false)
    .action(async (cmd) => {
        await strings(
            cmd.directory,
            cmd.output,
            cmd.extractUrls,
            cmd.extractedUrlPath,
            cmd.scanSecrets,
            cmd.permutate,
            cmd.openapi
        );
    });

program
    .command("api-gateway")
    .description("Configure AWS API Gateway to rotate IP addresses")
    .option("-i, --init", "Initialize the config file (create API)", false)
    .option("-d, --destroy <id>", "Destroy API with the given ID")
    .option(
        "--destroy-all",
        "Destroy all the API created by this tool in all regions",
        false
    )
    .option("-r, --region <region>", "AWS region (default: random region)")
    .option(
        "-a, --access-key <access-key>",
        "AWS access key (if not provided, AWS_ACCESS_KEY_ID environment variable will be used)"
    )
    .option(
        "-s, --secret-key <secret-key>",
        "AWS secret key (if not provided, AWS_SECRET_ACCESS_KEY environment variable will be used)"
    )
    .option(
        "-c, --config <config>",
        "Name of the config file",
        ".api_gateway_config.json"
    )
    .option("-l, --list", "List all the API created by this tool", false)
    .option("--feasibility", "Check feasibility of API Gateway", false)
    .option("--feasibility-url <url>", "URL to check feasibility of")
    .action(async (cmd) => {
        globalsUtil.setApiGatewayConfigFile(cmd.config);
        globalsUtil.setUseApiGateway(true);
        await apiGateway(
            cmd.init,
            cmd.destroy,
            cmd.destroyAll,
            cmd.list,
            cmd.region,
            cmd.accessKey,
            cmd.secretKey,
            cmd.config,
            cmd.feasibility,
            cmd.feasibilityUrl
        );
    });

program
    .command("map")
    .description("Map all the functions")
    .option("-d, --directory <directory>", "Directory containing JS files")
    .option(
        "-t, --tech <tech>",
        "Technology used in the JS files (run with -l/--list to see available options)"
    )
    .option("-l, --list", "List available technologies", false)
    .option(
        "-o, --output <file>",
        "Output file name (without extension)",
        "mapped"
    )
    .option(
        "-f, --format <format>",
        "Output format for the results comma-separated (available: JSON)",
        "json"
    )
    .option("-i, --interactive", "Interactive mode", false)
    .option(
        "--ai <options>",
        "Use AI to analyze the code (comma-separated; available: description)"
    )
    .option("--ai-threads <threads>", "Number of threads to use for AI", "5")
    .option(
        "--ai-provider <provider>",
        "Service provider to use for AI (available: openai, ollama)",
        "openai"
    )
    .option(
        "--ai-endpoint <endpoint>",
        "Endpoint to use for AI service (for Ollama, etc)"
    )
    .option("--openai-api-key <key>", "OpenAI API key")
    .option("--model <model>", "AI model to use", "gpt-4o-mini")
    .action(async (cmd) => {
        globalsUtil.setAi(cmd.ai?.split(",") || []);
        globalsUtil.setAiServiceProvider(cmd.aiProvider);
        globalsUtil.setOpenaiApiKey(cmd.openaiApiKey);
        globalsUtil.setAiModel(cmd.model);
        if (cmd.aiEndpoint) globalsUtil.setAiEndpoint(cmd.aiEndpoint);
        globalsUtil.setAiThreads(cmd.aiThreads);

        // validate AI options
        if (globalsUtil.getAi().length !== 0) {
            for (const aiType of globalsUtil.getAi()) {
                if (aiType !== "" && !validAiOptions.includes(aiType)) {
                    console.log(chalk.red(`[!] Invalid AI option: ${aiType}`));
                    return;
                }
            }
        }
        await map(
            cmd.directory,
            cmd.output,
            cmd.format.split(","),
            cmd.tech,
            cmd.list,
            cmd.interactive
        );
    });

program
    .command("run")
    .description("Run all modules")
    .requiredOption(
        "-u, --url <url>",
        "Target URL"
    )
    .option("-o, --output <directory>", "Output directory", "output")
    .option(
        "--strict-scope",
        "Download JS files from only the input URL domain",
        false
    )
    .option(
        "-s, --scope <scope>",
        "Download JS files from specific domains (comma-separated)",
        "*"
    )
    .option("-t, --threads <threads>", "Number of threads to use", "1")
    .option("--api-gateway", "Generate requests using API Gateway", false)
    .option(
        "--api-gateway-config <file>",
        "API Gateway config file",
        ".api_gateway_config.json"
    )
    .option(
        "--cache-file <file>",
        "File to store response cache",
        ".resp_cache.json"
    )
    .option("--disable-cache", "Disable response caching", false)
    .option(
        "-y, --yes",
        "Auto-approve executing JS code from the target",
        false
    )
    .option("--secrets", "Scan for secrets", false)
    .option(
        "--ai <options>",
        "Use AI to analyze the code (comma-separated; available: description)"
    )
    .option("--ai-threads <threads>", "Number of threads to use for AI", "5")
    .option(
        "--ai-provider <provider>",
        "Service provider to use for AI (available: openai, ollama)",
        "openai"
    )
    .option(
        "--ai-endpoint <endpoint>",
        "Endpoint to use for AI service (for Ollama, etc)"
    )
    .option("--openai-api-key <key>", "OpenAI API key")
    .option("--model <model>", "AI model to use", "gpt-4o-mini")
    .action(async (cmd) => {
        globalsUtil.setAi(cmd.ai?.split(",") || []);
        globalsUtil.setOpenaiApiKey(cmd.openaiApiKey);
        globalsUtil.setAiModel(cmd.model);
        globalsUtil.setAiServiceProvider(cmd.aiProvider);
        globalsUtil.setAiThreads(cmd.aiThreads);
        if (cmd.aiEndpoint) globalsUtil.setAiEndpoint(cmd.aiEndpoint);

        // validate AI options
        if (globalsUtil.getAi().length !== 0) {
            for (const aiType of globalsUtil.getAi()) {
                if (aiType !== "" && !validAiOptions.includes(aiType)) {
                    console.log(chalk.red(`[!] Invalid AI option: ${aiType}`));
                    return;
                }
            }
        }
        await run(cmd);
    });

program.parse(process.argv);
