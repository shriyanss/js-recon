# Analyze Command

The `analyze` command is a powerful feature that automates the entire JavaScript reconnaissance workflow by running a sequence of modules (`lazyload`, `endpoints`, `strings`, and `map`) on a target URL. This allows you to go from a single URL to a full analysis of its JavaScript files with just one command.

## Usage

To run the `analyze` command, you need to provide a target URL. The tool will handle the rest.

```bash
js-recon analyze -u <url>
```

## How It Works

The `analyze` command executes the following modules in order:

1.  **`lazyload`**: Downloads all JavaScript files from the target URL, including those that are loaded dynamically. The files are saved to an output directory (default: `output`).
2.  **`endpoints`**: Analyzes the downloaded JavaScript files to extract API endpoints and client-side routes.
3.  **`strings`**: Scans the JavaScript files for strings, URLs, and potential secrets.
4.  **`map`**: Maps all function calls within the JavaScript files to help you understand the application's logic.

All results are saved in the specified output directory, with each module creating its own output files (e.g., `endpoints.md`, `strings.json`, `mapped.json`).

## Options

The `analyze` command accepts all the same options as the `lazyload` command, allowing you to customize the file discovery process.

| Option | Description |
| --- | --- |
| `-u, --url <url/file>` | **(Required)** Target URL or a file containing a list of URLs. |
| `-o, --output <directory>` | Output directory for all results (default: `output`). |
| `--strict-scope` | Download JS files from only the input URL domain. |
| `-s, --scope <scope>` | Download JS files from specific domains (comma-separated). |
| `-t, --threads <threads>` | Number of threads to use (default: `1`). |
| `--subsequent-requests` | Download JS files from subsequent requests (Next.JS only). |
| `--api-gateway` | Generate requests using an AWS API Gateway. |

For a full list of options, run:

```bash
js-recon analyze --help
```
