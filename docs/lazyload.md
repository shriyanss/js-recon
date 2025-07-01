# Lazyload Command

The `lazyload` command is used to download JavaScript files from a given URL or a list of URLs. It simulates a various techniques to discover and fetch JS files that are loaded dynamically.

## Usage

```bash
js-recon lazyload -u <url/file> [options]
```

## Options

| Option | Alias | Description | Default | Required |
| --- | --- | --- | --- | --- |
| `--url <url/file>` | `-u` | Target URL or a file containing a list of URLs (one per line). | | Yes |
| `--output <directory>` | `-o` | Output directory to save the downloaded JS files. | `output` | No |
| `--strict-scope` | | Download JS files from only the input URL domain. | `false` | No |
| `--scope <scope>` | `-s` | Download JS files from specific domains (comma-separated). Use `*` for all domains. | `*` | No |
| `--threads <threads>` | `-t` | Number of threads to use for downloading. | `1` | No |
| `--subsequent-requests` | | Download JS files from subsequent requests (Next.JS only). | `false` | No |
| `--urls-file <file>` | | Input JSON file containing URLs. | `extracted_urls.json` | No |
| `--api-gateway` | | Generate requests using API Gateway for IP rotation. | `false` | No |
| `--api-gateway-config <file>` | | API Gateway config file. | `.api_gateway_config.json` | No |
| `--cache-file <file>` | | File to contain response cache. | `.resp_cache.json` | No |
| `--disable-cache` | | Disable response caching. | `false` | No |
| `--yes` | `-y` | Auto-approve executing JS code from the target. | `false` | No |

## Examples

### Basic Usage

Download all JavaScript files from a single URL:

```bash
js-recon lazyload -u https://example.com
```

### Using a File of URLs

Download JavaScript files from a list of URLs specified in a file:

```bash
js-recon lazyload -u urls.txt
```

### Setting Scope

Download JavaScript files only from `example.com` and `cdn.example.com`:

```bash
js-recon lazyload -u https://example.com -s "example.com,cdn.example.com"
```

### Using API Gateway

Use AWS API Gateway to rotate IP addresses while downloading:

```bash
js-recon lazyload -u https://example.com --api-gateway
```

Read docs of [API Gateway](./api-gateway.md) for more information.