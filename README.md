# JS Recon

![NPM Licence](https://img.shields.io/npm/l/%40shriyanss%2Fjs-recon) ![GitHub repo size](https://img.shields.io/github/repo-size/shriyanss/js-recon) ![NPM Downloads](https://img.shields.io/npm/dm/%40shriyanss%2Fjs-recon) ![GitHub commit activity (dev)](https://img.shields.io/github/commit-activity/w/shriyanss/js-recon/dev) ![NPM Last Update](https://img.shields.io/npm/last-update/%40shriyanss%2Fjs-recon) ![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/shriyanss/js-recon)

<p align="center">
  <a href="https://js-recon.io">
    <img src="https://js-recon.io/img/js-recon-logo.png" alt="JS Recon Logo" width="100">
  </a>
</p>

A powerful tool for JavaScript reconnaissance. `js-recon` helps you discover, download, and analyze JavaScript files to uncover endpoints, secrets, and other valuable information from any web application running supported frameworks.

It can also reconstruct HTTP requests that the app makes to the server, and output them to the OpenAPI spec.

## Installation

This tool requires Node.JS and `npm` to be installed. The [official download page](https://nodejs.org/en/download) can be referred. Please install **22.17.0 (LTS)** or later. Downloading older versions might break the tool.

To install the tool globally, run:

```bash
npm i -g @shriyanss/js-recon
```

For detailed installation and setup process, please refer to the [Installation page](https://js-recon.io/docs/docs/installation)

## Framework Support

The features in JS Recon tool are built after thorough research on apps running different frameworks.

Please refer to the [Framework Support](https://js-recon.io/docs/docs/framework-support) page for detailed information on feature compatibility across different frameworks.

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

| Command       | Description                                                                   | Documentation                                                  |
| ------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `lazyload`    | Downloads dynamically loaded JavaScript files from a target.                  | [Read Docs](https://js-recon.io/docs/docs/modules/lazyload)    |
| `endpoints`   | Extracts API endpoints and client-side paths from JS files.                   | [Read Docs](https://js-recon.io/docs/docs/modules/endpoints)   |
| `strings`     | Extracts strings, URLs, and potential secrets from JS files.                  | [Read Docs](https://js-recon.io/docs/docs/modules/strings)     |
| `map`         | Maps function calls and analyzes code, with optional AI-powered descriptions. | [Read Docs](https://js-recon.io/docs/docs/modules/map)         |
| `api-gateway` | Manages AWS API Gateway for IP rotation to bypass rate limits.                | [Read Docs](https://js-recon.io/docs/docs/modules/api-gateway) |
| `run`         | Runs all analysis modules automatically on a target.                          | [Read Docs](https://js-recon.io/docs/docs/modules/run)         |
| `analyze`     | Analyzes the code.                                                            | [Read Docs](https://js-recon.io/docs/docs/modules/analyze)     |
| `report`      | Generates a report from the analysis modules.                                 | [Read Docs](https://js-recon.io/docs/docs/modules/report)      |

## Key Features

- Downloads all dynamically loaded JS files (refered as `lazyload`) from website with supported frameworks
- Use API gateway to rotate IP addresses to bypass firewall
- Extract strings from the discovered JS files, and extract potential secrets, endpoints, etc. from them
- Endpoints modules extracts client-side paths from the app
- Map feature analyzes the JS files and outputs it to a JSON file. An interactive mode can be then used to analyze it
- Reconstruct HTTP requests that the app makes to the server, and output them to the OpenAPI spec
- Run analyze to find potential issues in JS code and the HTTP requests the app makes
- Generate a report from the analyze module

## Example Scenario

Refer to [this page](https://js-recon.io/docs/docs/example-scenarios/next-js) where an example scenario of running this tool against a Next.JS target is demonstrated.

## Documentation

For detailed guides, command options, and advanced usage examples, please check out the JS Recon Site at https://js-recon.io

## Labs

![JS Recon labs banner](https://github.com/shriyanss/js-recon-labs/blob/main/static/labs-banner.png?raw=true)

Labs to test JS Recon tool are available [here](https://github.com/shriyanss/js-recon-labs). Walkthroughs are available [here](https://js-recon.io/labs).

## Contributing

Please refer to the [Contributing](https://js-recon.io/contributing) page for detailed information on contributing to this project.

## License

JS Recon is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
