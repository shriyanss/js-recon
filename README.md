# js-recon

A powerful tool for JavaScript reconnaissance. `js-recon` helps you discover, download, and analyze JavaScript files to uncover endpoints, secrets, and other valuable information from any web application.

## Installation

To install the tool globally, run:

```bash
npm i -g @shriyanss/js-recon
```

## Quick Start

```bash
# Get a list of all commands
js-recon --help

# Get help for a specific command
js-recon <command> --help
```

## Commands

`js-recon` provides a suite of commands for comprehensive JavaScript analysis. For detailed usage and examples, please refer to our full documentation.

| Command       | Description                                                                   | Documentation                      |
| ------------- | ----------------------------------------------------------------------------- | ---------------------------------- |
| `lazyload`    | Downloads dynamically loaded JavaScript files from a target.                  | [Read Docs](./docs/lazyload.md)    |
| `endpoints`   | Extracts API endpoints and client-side paths from JS files.                   | [Read Docs](./docs/endpoints.md)   |
| `strings`     | Extracts strings, URLs, and potential secrets from JS files.                  | [Read Docs](./docs/strings.md)     |
| `map`         | Maps function calls and analyzes code, with optional AI-powered descriptions. | [Read Docs](./docs/map.md)         |
| `api-gateway` | Manages AWS API Gateway for IP rotation to bypass rate limits.                | [Read Docs](./docs/api-gateway.md) |
| `run`         | Runs all analysis modules automatically on a target.                          | [Read Docs](./docs/run.md)         |

## Key Features

- **Discover Lazy-Loaded Files**: Uncover JavaScript files that are loaded dynamically, which are often missed by traditional crawlers.
- **Extract Endpoints and Secrets**: Automatically parse JavaScript to find API endpoints, paths, and potential hardcoded secrets.
- **Analyze Modern Frameworks**: Specialized support for frameworks like Next.JS to extract framework-specific information.
- **Bypass Rate-Limiting**: Integrates with AWS API Gateway to rotate your IP address on every request, helping to avoid blocks and rate limits.

## Documentation

For detailed guides, command options, and advanced usage examples, please check out the **[full documentation here](./docs/README.md)**.
