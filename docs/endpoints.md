# Endpoints Command

The `endpoints` command is used to extract API endpoints from a directory of JavaScript files. It identifies potential client-side and/or API paths and organizes them for further analysis.

## Usage

```bash
js-recon endpoints [options]
```

## Options

| Option | Alias | Description | Default | Required |
| --- | --- | --- | --- | --- |
| `--url <url>` | `-u` | Target Base URL (will be used to resolve relative paths). | | Yes |
| `--directory <directory>` | `-d` | Directory containing JS files. | | Yes |
| `--output <filename>` | `-o` | Output filename (without file extension). | `endpoints` | Yes |
| `--output-format <format>` | | Output format for the results (comma-separated; available: `md`, `json`). | `md` | No |
| `--tech <tech>` | `-t` | Technology used in the JS files (run with `-l`/`--list` to see available options). | | Yes |
| `--list` | `-l` | List available technologies. | `false` | No |
| `--subsequent-requests-dir <directory>` | | Directory containing subsequent requests. **Required for Next.JS (`--tech next`)**. | | No |

## Examples

### Basic Usage

Extract endpoints from a directory of JS files, specifying the technology and target URL:

```bash
js-recon endpoints -d /path/to/js-files -t <technology> -u https://example.com
```

### Specify Output File

Extract endpoints and save them to a custom file named `api_paths.md`:

```bash
js-recon endpoints -d /path/to/js-files -t <technology> -u https://example.com -o api_paths
```

### Next.JS Usage

When analyzing a Next.JS application, you must specify the technology as `next` and provide the directory containing subsequent requests. These requests are typically captured during the `lazyload` process.

```bash
js-recon endpoints -d /path/to/js-files -t next -u https://example.com --subsequent-requests-dir /path/to/js-files/___subsequent_requests
```

This command will analyze the JavaScript files and the subsequent requests to extract a comprehensive list of client-side paths and API endpoints specific to the Next.JS framework.
