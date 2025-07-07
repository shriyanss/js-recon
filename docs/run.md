# Run Command

The `run` command is a powerful feature that automates the most of the JavaScript reconnaissance workflow by executing a series of modules in a predefined order. This command is ideal for users who want to perform a basic analysis of a target without running each module individually.

## Workflow

The `run` command executes the following modules in sequence:

1.  **Lazy Load (Initial)**: Downloads the initial set of JavaScript files from the target URL.
2.  **Strings (Initial)**: Extracts strings, URLs, and paths from the downloaded JavaScript files.
3.  **Lazy Load (Subsequent Requests - for Next.JS)**: Downloads additional JavaScript files discovered from the extracted URLs and paths.
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

| Option                        | Alias | Description                                                          | Default                                                                         | Required |
| ----------------------------- | ----- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------- |
| `--url <url/file>`            | `-u`  | Target URL or a file containing a list of URLs (one per line)        |                                                                                 | Yes      |
| `--output <directory>`        | `-d`  | Output directory                                                     | `output`                                                                        | No       |
| `--strict-scope`              |       | Download JS files from only the input URL domain                     | `false`                                                                         | No       |
| `--scope <scope>`             | `-s`  | Download JS files from specific domains (comma-separated)            | `*`                                                                             | No       |
| `--threads <threads>`         | `-t`  | Number of threads to use                                             | `1`                                                                             | No       |
| `--api-gateway`               |       | Generate requests using API Gateway                                  | `false`                                                                         | No       |
| `--api-gateway-config <file>` |       | API Gateway config file                                              | `.api_gateway_config.json`                                                      | No       |
| `--cache-file <file>`         |       | File to store response cache                                         | `.resp_cache.json`                                                              | No       |
| `--disable-cache`             |       | Disable response caching                                             | `false`                                                                         | No       |
| `--yes`                       | `-y`  | Auto-approve executing JS code from the target                       | `false`                                                                         | No       |
| `--secrets`                   |       | Scan for secrets                                                     | `false`                                                                         | No       |
| `--ai <options>`              |       | Use AI to analyze the code (comma-separated; available: description) |                                                                                 | No       |
| `--ai-threads <threads>`      |       | Number of threads to use for AI                                      | `5`                                                                             | No       |
| `--ai-provider <provider>`    |       | Service provider to use for AI (available: openai, ollama)           | `openai`                                                                        | No       |
| `--ai-endpoint <endpoint>`    |       | Endpoint to use for AI service (for Ollama, etc)                     | `https://api.openai.com/v1` for OpenAI, and `http://127.0.0.1:11434` for Ollama | No       |
| `--openai-api-key <key>`      |       | OpenAI API Key                                                       |                                                                                 | No       |
| `--model <model>`             |       | AI model to use                                                      | `gpt-4o-mini` for OpenAI, and `llama3.1` for Ollama                             | No       |

## Example

```bash
js-recon run -u https://example.com -o results --secrets --ai description
```

This command will perform a full analysis on `https://example.com`, save the output to the `results` directory, scan for secrets, and use AI to generate descriptions for the mapped functions.
