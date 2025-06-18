# js-recon
## Installation
To install the tool, run:
```bash
npm i -g @shriyanss/js-recon
```

## Usage
```
$ js-recon -h
Usage: js-recon [options] [command]

JS Recon Tool

Options:
  -V, --version          output the version number
  -h, --help             display help for command

Commands:
  lazyload [options]     Run lazy load module
  endpoints [options]    Extract API endpoints
  strings [options]      Extract strings from JS files
  api-gateway [options]  Configure AWS API Gateway to rotate IP addresses
  help [command]         display help for command
```

### Lazy load
```
$ js-recon lazyload -h
Usage: js-recon lazyload [options]

Run lazy load module

Options:
  -u, --url <url/file>         Target URL or a file containing a list of URLs (one per line)
  -o, --output <directory>     Output directory (default: "output")
  --strict-scope               Download JS files from only the input URL domain (default: false)
  -s, --scope <scope>          Download JS files from specific domains (comma-separated) (default: "*")
  -t, --threads <threads>      Number of threads to use (default: 1)
  --subsequent-requests        Download JS files from subsequent requests (default: false)
  --urls-file <file>           Input JSON file containing URLs (default: "extracted_urls.json")
  --api-gateway                Generate requests using API Gateway (default: false)
  --api-gateway-config <file>  API Gateway config file (default: ".api_gateway_config.json")
  -h, --help                   display help for command
```

### Strings
```
$ js-recon strings -h
Usage: js-recon strings [options]

Extract strings from JS files

Options:
  -d, --directory <directory>  Directory containing JS files
  -o, --output <file>          JSON file to save the strings (default: "strings.json")
  -e, --extract-urls           Extract URLs from strings (default: false)
  --extracted-url-path <file>  Output JSON file for extracted URLs and paths (default: "extracted_urls.json")
  -h, --help                   display help for command
```

### API Gateway
```
$ js-recon api-gateway -h
Usage: js-recon api-gateway [options]

Configure AWS API Gateway to rotate IP addresses

Options:
  -i, --init                     Initialize the config file (create API) (default: false)
  -d, --destroy <id>             Destroy API with the given ID
  --destroy-all                  Destroy all the API created by this tool in all regions (default: false)
  -r, --region <region>          AWS region (default: random region)
  -a, --access-key <access-key>  AWS access key (if not provided, AWS_ACCESS_KEY_ID environment variable will be used)
  -s, --secret-key <secret-key>  AWS secret key (if not provided, AWS_SECRET_ACCESS_KEY environment variable will be used)
  -c, --config <config>          Name of the config file (default: ".api_gateway_config.json")
  -l, --list                     List all the API created by this tool (default: false)
  --feasibility                  Check feasibility of API Gateway (default: false)
  --feasibility-url <url>        URL to check feasibility of
  -h, --help                     display help for command
```

## Features
### Download lazy loaded JS files
You can download the lazy loaded files. To do so, you can run the following command
```bash
js-recon lazyload -u <url> -o <output>
```

For example, you can try this with [Vercel Docs](https://vercel.com/docs):
```bash
js-recon lazyload -u https://vercel.com/docs
```

Currently, the following JS frameworks are supported:
- Next.js (read research [here](research/next_js.md))

### Extract strings from JS files
You can extract strings from JS files. To do so, you can run the following command
```bash
js-recon strings -d <directory> -o <output>
```

For example, you can try this with [1Password](https://1password.com):
```bash
js-recon strings -d output/1password.com -o strings.json
```

## Examples
### Get all possible JS files for a Next.js app
*You can read the full research for the same [here](research/next_js.md#lazy-loaded-files)*

First of all, run the lazy load module (strict scope and 1 thread for accurate results) [research1](research/next_js.md#analysis-of-vercel-docs):
```bash
js-recon lazyload -u <url> -o <output> --strict-scope -t 1
```

Then, get all the strings from the JS files found. Also, extract URLs and paths found in those JS files.:
```bash
js-recon strings -d <directory> -o <output> -e
```

Finally, parse those URLs and paths to get more JS files (note the `--subsequent-requests` flag apart from `--strict-scope` and `--threads`) [research](research/next_js.md#analysis-of-xai):
```bash
js-recon endpoints -u <url> -o <output> --strict-scope -t 1 --subsequent-requests
```

### Use AWS API Gateway to rotate IP address on each request
First of all, the user has to configure the API keys for AWS with right permissions to use the API Gateway module of the tool. The access key and the secret key can be stored in the environment variables `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` respectively. Alternatively, these can be provided as command line argument to the tool.

Once this is done, the configuration file can be generated. The configuration file is a JSON file that contains the API Gateway information, including the API Gateway ID, region, access key, and secret key. This file is used by the tool in the runtime. The configuration file can be generated by running the following command:
```bash
js-recon api-gateway -i -r <region> -a <access-key> -s <secret-key>
```
If the region is not provided, the tool will select a random region from a pre-defined list. If the `-a` and `-s` flags aren't provided, it will default to the environment variables `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` respectively.

This command will generate a new API gateway in the specified region, which can be inspected on the AWS console. The API gateway ID will be stored in the configuration file. The configuration file can be found at `./.api_gateway_config.json` by default.

The user can list the API gateways generated by running the following command:
```bash
js-recon api-gateway -l
```

The user can generate as many API gateways as they want. The tool will automatically select a random API gateway from the configuration file to make requests to. Creating multiple gateways in different region can help in changing the region of the IP address on each request, however, **creating multiple gateways in the same region is not recommended** as AG will rotate the IP address on each request.

It is recommended to check if the firewall is blocking the requests from the API gateway. The user can do so by running the following command:
```bash
js-recon api-gateway --feasibility --feasibility-url <url>
```

Next, the API gateway can be utilized for rotating the IP address on each request. To do so, the user can add the `--api-gateway` flag to the lazy load module. The user can also provide the API gateway config file using the `--api-gateway-config` flag if they have changed the defaults.

For example,
```bash
js-recon lazyload -u <url> -o <output> --api-gateway
```

Now that the user has completed their task, they can delete the API gateway using the following command:
```bash
js-recon api-gateway -d <api-gateway-id>
```

Alternatively, they can delete all the API gateways using the following command:
```bash
js-recon api-gateway --destroy-all
```
