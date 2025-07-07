# Strings Command

The `strings` command is used to extract strings, URLs, and secrets from a directory of JavaScript files. This is useful for identifying sensitive information and potential API endpoints.

## Usage

```bash
js-recon strings -d <directory> [options]
```

## Options

| Option                        | Alias | Description                                                   | Default          | Required |
| ----------------------------- | ----- | ------------------------------------------------------------- | ---------------- | -------- |
| `--directory <directory>`     | `-d`  | Directory containing JS files.                                |                  | Yes      |
| `--output <file>`             | `-o`  | JSON file to save the extracted strings.                      | `strings.json`   | No       |
| `--extract-urls`              | `-e`  | Extract URLs from the strings.                                | `false`          | No       |
| `--extracted-url-path <file>` |       | Output file for extracted URLs and paths (without extension). | `extracted_urls` | No       |
| `--permutate`                 | `-p`  | Permutate the URLs and paths found.                           | `false`          | No       |
| `--openapi`                   |       | Generate an OpenAPI specification from the paths found.       | `false`          | No       |
| `--scan-secrets`              | `-s`  | Scan for secrets within the strings.                          | `false`          | No       |

## Examples

### Basic Usage

Extract all strings from a directory of JS files and save them to `strings.json`:

```bash
js-recon strings -d /path/to/js-files
```

### Extract URLs

Extract strings and also identify and save any URLs found within them:

```bash
js-recon strings -d /path/to/js-files -e
```

This will write a new file called `extracted_urls.json` along with the default `strings.json`

### Scan for Secrets

Extract strings and scan for any potential secrets or sensitive information:

```bash
js-recon strings -d /path/to/js-files -s
```

This will print all the potential finds on the terminal window.

*Please note that this process could be memory and compute intensive, and can take longer to run.*

### Generate OpenAPI Specification

Extract URLs and paths, and then generate an OpenAPI specification:

```bash
js-recon strings -d /path/to/js-files -e --openapi
```

This will generate the default `strings.json`, the `extracted_urls.json` file with URLs and paths in simple JSON format, and the `extracted_urls-openapi.json` file. The `extracted_urls-openapi.json` can be imported into API clients like [Postman](https://www.postman.com), [Bruno](https://www.usebruno.com), etc.

### Permutate URLs and Paths

The `--permutate` (`-p`) flag generates new potential endpoints by combining the base of found URLs with all discovered paths. This requires the `-e` flag to be active.

For example, if the tool finds the URL `https://api.example.com/v1/users` and the path `/v2/orders`, it will generate `https://api.example.com/v2/orders`.

```bash
js-recon strings -d /path/to/js-files -e -p
```

The permuted URLs will be saved to `extracted_urls.txt` along with `strings.json` and `extracted_urls.json`
