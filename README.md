# JS Recon
![NPM Licence](https://img.shields.io/npm/l/%40shriyanss%2Fjs-recon) ![GitHub repo size](https://img.shields.io/github/repo-size/shriyanss/js-recon) ![NPM Downloads](https://img.shields.io/npm/dm/%40shriyanss%2Fjs-recon) ![GitHub commit activity (dev)](https://img.shields.io/github/commit-activity/w/shriyanss/js-recon/dev) ![NPM Last Update](https://img.shields.io/npm/last-update/%40shriyanss%2Fjs-recon) ![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/shriyanss/js-recon)

A powerful tool for JavaScript reconnaissance. `js-recon` helps you discover, download, and analyze JavaScript files to uncover endpoints, secrets, and other valuable information from any web application running supported frameworks

## Installation

This tool requires Node.JS and `npm` to be installed. The [official download page](https://nodejs.org/en/download) can be referred. Please install **22.17.0 (LTS)** or later. Downloading older versions might break the tool.

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

To launch a quick assesment against a target, the `run` module can be used to automate other modules

```bash
js-recon run -u https://app.example.com
```

## Commands

`js-recon` provides a suite of commands for comprehensive JavaScript analysis. For detailed usage and examples, please refer to its full documentation.

**_The `lazyload` module will work on Next.JS, Nuxt.JS, and Svelte apps. All other modules are only expected to work on Next.JS apps._**

| Command       | Description                                                                   | Documentation                      |
| ------------- | ----------------------------------------------------------------------------- | ---------------------------------- |
| `lazyload`    | Downloads dynamically loaded JavaScript files from a target.                  | [Read Docs](./docs/lazyload.md)    |
| `endpoints`   | Extracts API endpoints and client-side paths from JS files.                   | [Read Docs](./docs/endpoints.md)   |
| `strings`     | Extracts strings, URLs, and potential secrets from JS files.                  | [Read Docs](./docs/strings.md)     |
| `map`         | Maps function calls and analyzes code, with optional AI-powered descriptions. | [Read Docs](./docs/map.md)         |
| `api-gateway` | Manages AWS API Gateway for IP rotation to bypass rate limits.                | [Read Docs](./docs/api-gateway.md) |
| `run`         | Runs all analysis modules automatically on a target.                          | [Read Docs](./docs/run.md)         |

## Key Features

- Downloads all dynamically loaded JS files (refered as `lazyload`) from website with supported frameworks
- Use API gateway to rotate IP addresses to bypass firewall
- Extract strings from the discovered JS files, and extract potential secrets, endpoints, etc. from them
- Endpoints modules extracts client-side paths from the app
- Map feature analyzes the JS files, and outputs it to a JSON file. An interactive mode can be then used to analyze it

## Example Scenario

Refer to [this page](./docs/example-scenario.md) where an example scenario of running this tool against a target is demonstrated.

## Documentation

For detailed guides, command options, and advanced usage examples, please check out the **[full documentation here](./docs/README.md)**.
