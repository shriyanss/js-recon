# Run Command

The `run` command is a powerful feature that automates the entire JavaScript reconnaissance workflow by executing a series of modules in a predefined order. This command is ideal for users who want to perform a comprehensive analysis of a target without running each module individually.

## Workflow

The `run` command executes the following modules in sequence:

1.  **Lazy Load (Initial)**: Downloads the initial set of JavaScript files from the target URL.
2.  **Strings (Initial)**: Extracts strings, URLs, and paths from the downloaded JavaScript files.
3.  **Lazy Load (Subsequent Requests)**: Downloads additional JavaScript files discovered from the extracted URLs and paths.
4.  **Strings (Final)**: Performs another round of string extraction on the newly downloaded files to find more endpoints, secrets, and other valuable information.
5.  **Endpoints**: Analyzes the collected data to identify and list all potential API endpoints.
6.  **Map**: Maps all the functions and their relationships within the JavaScript files to provide a clear overview of the application's structure.

## Usage

```bash
js-recon run -u <url/file> [options]
```

### Required Arguments

- `-u, --url <url/file>`: The target URL or a file containing a list of URLs (one per line).

### Options

- `-o, --output <directory>`: Output directory for the results. (Default: `output`)
- `--strict-scope`: Download JavaScript files from only the input URL domain. (Default: `false`)
- `-s, --scope <scope>`: Download JavaScript files from specific domains (comma-separated). (Default: `*`)
- `-t, --threads <threads>`: Number of threads to use for downloading. (Default: `1`)
- `--api-gateway`: Use AWS API Gateway to rotate IP addresses for requests.
- `--api-gateway-config <file>`: API Gateway configuration file. (Default: `.api_gateway_config.json`)
- `--cache-file <file>`: File to contain response cache. (Default: `.resp_cache.json`)
- `--disable-cache`: Disable response caching.
- `-y, --yes`: Auto-approve executing JavaScript code from the target. (Default: `false`)
- `--secrets`: Scan for secrets in the JavaScript files.
- `--ai <options>`: Use AI to analyze the code (comma-separated; available: `description`).
- `--ai-threads <threads>`: Number of threads to use for AI analysis. (Default: `5`)
- `--openai-api-key <key>`: OpenAI API key for AI-powered analysis.
- `--model <model>`: AI model to use. (Default: `gpt-4o-mini`)

## Example

```bash
js-recon run -u https://example.com -o results --secrets --ai description
```

This command will perform a full analysis on `https://example.com`, save the output to the `results` directory, scan for secrets, and use AI to generate descriptions for the mapped functions.
