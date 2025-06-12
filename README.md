# js-recon
## Installation
To install all the required modules, run:
```bash
npm i
```

## Usage
```
$ node index.js -h
Usage: index [options] [command]

JS Recon Tool

Options:
  -V, --version        output the version number
  -h, --help           display help for command

Commands:
  lazyload [options]   Run lazy load module
  endpoints [options]  Extract API endpoints
  strings [options]    Extract strings from JS files
  help [command]       display help for command
```

### Lazy load
```
$ node index.js lazyload -h
Usage: index lazyload [options]

Run lazy load module

Options:
  -u, --url <url/file>      Target URL or a file containing a list of
                            URLs (one per line)
  -o, --output <directory>  Output directory (default: "output")
  --strict-scope            Download JS files from only the input URL
                            domain (default: false)
  -s, --scope <scope>       Download JS files from specific domains
                            (comma-separated) (default: "*")
  -t, --threads <threads>   Number of threads to use (default: 1)
  -h, --help                display help for command

```

### Strings
```
$ node index.js strings -h
Usage: index strings [options]

Extract strings from JS files

Options:
  -d, --directory <directory>  Directory containing JS files
  -o, --output <file>          JSON file to save the strings (default: "strings.json")
  -h, --help                   display help for command
```

## Features
### Download lazy loaded JS files
You can download the lazy loaded files. To do so, you can run the following command
```bash
node index.js lazyload -u <url> -o <output>
```

For example, you can try this with [Vercel Docs](https://vercel.com/docs):
```bash
node index.js lazyload -u https://vercel.com/docs
```

Currently, the following JS frameworks are supported:
- Next.js (read research [here](research/next_js.md))

### Extract strings from JS files
You can extract strings from JS files. To do so, you can run the following command
```bash
node index.js strings -d <directory> -o <output>
```

For example, you can try this with [1Password](https://1password.com):
```bash
node index.js strings -d output/1password.com -o strings.json
```

## Examples
### Get all possible JS files for a Next.js app
*You can read the full research for the same [here](research/next_js.md#lazy-loaded-files)*

First of all, run the lazy load module (strict scope and 1 thread for accurate results) [research1](research/next_js.md#analysis-of-vercel-docs):
```bash
node index.js lazyload -u <url> -o <output> --strict-scope -t 1
```

Then, get all the strings from the JS files found. Also, extract URLs and paths found in those JS files.:
```bash
node index.js strings -d <directory> -o <output> -e
```

Finally, parse those URLs and paths to get more JS files (note the `--subsequent-requests` flag apart from `--strict-scope` and `--threads`) [research](research/next_js.md#analysis-of-xai):
```bash
node index.js endpoints -u <url> -o <output> --strict-scope -t 1 --subsequent-requests
```
