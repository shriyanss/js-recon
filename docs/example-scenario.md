# Example Scenario of using JS-Recon
This document highlights using the modules of JS-Recon individually. All of this can be automated, which can be found at the end of the file in the [Run Module](#run-module).

This example assumes that the app is a Next.JS targets. The tool is currently optimized for Next.JS.

The `lazyload` module will work on Next.JS, Nuxt.JS, and Svelte apps. All other modules are only expected to work on Next.JS apps.

## Table of Contents
- [Target](#target)
- [Initial Recon](#initial-recon)
- [Downloading JS files](#downloading-js-files)
- [Finding strings](#finding-strings)
- [Subseqent Requests](#subseqent-requests)
- [Getting more with strings analysis](#getting-more-with-strings-analysis)
- [Getting client-side endpoints](#getting-client-side-endpoints)
- [Mapping all the functions](#mapping-all-the-functions)
- [Launching interactive console](#launching-interactive-console)
- [Run Module](#run-module)

## Target
The client provides the pentester a wildcard target `*.example.com`

## Initial Recon
The pentester starts by gathering subdomains for the target, and then uses HTTP probe to filter out all the available HTTP servers.

They decide to analyze JavaScript of all the websites to gain access to additional attack surface.

## Downloading JS files
To download JS files, the pentester can use the [`lazyload` module](./lazyload.md) of the tool. To run this, they can use the following command:
```bash
js-recon lazyload -u https://app.example.com
```

The tool will then analyze the responses from the server, and then download all the JS files it could find. The JS files will be written in the `./output/app.example.com` directory. If the app contains external scripts, then those will be written in the `./output/<domain>` directory.

The pentester could get the URL from the top of each file, as the tool writes all the JS files with their source commented on the top

*At the time of writing this, the tool is capable of downloading JS files for **Next.JS, Nuxt.JS, and Svelte**. For all other apps, it will download the JS files that are loaded on the webpage*

## Finding strings
Once the pentester has downloaded all the JS files, the first thing that they would like to do is to analyze all the strings that are found in the app. To do so, they can run the [`strings` module](./strings.md).

```bash
js-recon strings -d output/app.example.com -e
```

Breakdown of the command:
- `strings`: Run the module to analyze strings
- `-d`: Shorthand flag for `--directory`. Defines the directory containing the JS files. If any changes to default values hasn't been done in previous command, it should be `./output/<domain>`
- `-e`: Shorthand flag for `--extract-urls`. Iterates through all the strings found, and prints any potential URLs or paths by matching against the regex
    - The output for this flag is `extracted_urls.json`
    - In case that the pentester wants to output it as an OpenAPI collection to load in an API client, they can use the `--openapi` flag. It will be written in `extracted_urls-openapi.json`

The `extracted_urls.json` has the following structure:
```json
{
    "urls": [
        "https://api.example.com",
        "https://rum.example.com",
        "https://www.example.com",
        "https://app.example.com",
        "https://internal.app.com"
    ],
    "paths": [
        "/v1/admin",
        "/v1/dashboard",
        "/v1/members",
        "/v1/report",
        "/v1/settings",
        "/v1/edit"
    ]
}
```

## Subseqent Requests
JS-Recon has found that the app is using Next.JS. This framework has a feature that upon sending requests to a valid client-side endpoints along with the `RSC: 1` header, the application returns a response with content type `text/x-component`, which contains more client-side paths and JS files. To get this, the tool requires the `extracted_urls.json` from the strings module, which has been generated in the previous step.

To use this method, the pentester can pass the `--subsequent-requests` flag to the lazyload command:
```bash
js-recon lazyload -u https://app.example.com --subsequent-requests
```
By passing this flag, the tool will read the `extracted_urls.json` file, and make HTTP requests accordingly, and then save the files found in the `output/app.example.com` directory.

## Getting more with strings analysis
Now that the tester has got more JS files, they can run string analysis again. This time, they should pass a few more arguments to the tool:
```bash
js-recon strings -d output/app.example.com -e -p --openapi -s
```

Breakdown of additional flags:
- `-p`: Shorthand flag for `--permutate`. This will permutate the `urls` and `paths` in the `extracted_urls.json` file. The output will be a plaintext (`.txt`) file called `extracted_urls.txt`
- `--openapi`: This flag will genetate an output file called `extracted_urls-openapi.json`. This file is based on the `paths` in the `extracted_urls.json`, and can be directly loaded into an API client like [Postman](https://www.postman.com) or [Bruno](https://usebruno.com)
- `-s`: Shorthand flag for `--scan-secrets`. This will iterate over all the strings found, and match it against regex for popular secrets

## Getting client-side endpoints
Now that the pentester has got all the JS files and a rough ideation of what the app can do (through string analysis), they can now get the exact client-side endpoints. Apart from unique implementations, there are some common ways a web-app stores client-side endpoints. The tool utilizes the common methods to find the client-side endpoints in the web app.

To do so, they can use the `endpoints` module of the tool
```bash
js-recon endpoints -d output/app.example.com -u https://app.example.com -t next --subsequent-requests-dir output/app.example.com/___subsequent_requests
```

Breakdown of the command:
- `endpoints`: This module extracts client-side endpoints from the app
- `-d`: Shorthand flag for `--directory`. Defines the directory in which the JS files are stored for the given target
- `-u`: Shorthand flag for `--urls`. The URL of the target (the paths found are prepended to it)
- `-t`: Shorthand flag for `--tech`. Defines the framework (aka tech) that the target is using. It is required to find the suitable methods
    - Run with `-l`/`--list` to see list of supported tech: `js-recon endpoints -l`
- `--subsequent-requests-dir`: Flag specific to Next.js (`-t next`) targets. Defines the directory containing response texts for requests with `RSC: 1` header. By default, it is `output/<domain>/___subsequent_requests` (triple underscore `_` before `subsequent_requests`)

This command will write a file called `endpoints.json`. Following is an example of this file:
```json
{
    "https://app.example.com": {
        "/": {},
        "/dash": {
            "/dash/clients",
            "/dash/automations",
            "/dash/usage"
        },
        "/settings": {
            "/settings/clients": {
                "/settings/clients/edit",
                "/settings/clients/add"
            },
            "/settings/automations",
            "/settings/usage"
        }
    },
    "https://internal.example.com": {
        "/prod": {
            "/prod/env"
        }
    }
}
```

## Mapping all the functions
At this point, the pentester has got an idea of what the app looks like. They have also used the app to see the functionality in action. Now, they suspect that the app contains a secret endpoint. They have seen `https://internal.app.com` in the strings output, but are unsure how it works. They decide to manually analyze the JS files. This is where the `map` modules could help them.

They would like to first get all the instances of `fetch()` to know which functions can make the API calls. Apart from this, they would also like to get the AI-generated descriptions for the functions, as it would significantly speed up the process of analyzing the flow of all the functions. To do so, they can run the `map` module of the tool.
```bash
js-recon map -d output/app.example.com -t next --ai description
```

Breakdown of the command:
- `map`: Runs the `map` module
- `-d`: Shorthand flag for `--directory`. Defines the directory of the JS files
- `-t`: Shorthand flag for `--tech`. Defines the technology (aka framework) used by the app
    - Run with `-l`-/`--list` flag to see a supported frameworks
    - `js-recon map -l`
- `--ai`: Enable AI parsing. `description` is used as its value, which means that the tool will write descriptions for the functions

The pentester can also adjust some AI settings:
- `--ai-provider`: AI provider to use
    - `openai` and `ollama` are supported as of writing this
- `--model`: AI model to use
- `--openai-api-key`: API key to use for OpenAI
    - The value for environment variable `$OPENAI_API_KEY` will be used if not provided
- `--ai-threads <threads>`: Number of threads to simultaneously run to generate descriptions
    - Refer to [Organization Limits](https://platform.openai.com/settings/organization/limits) in [OpenAI API Platform](https://platform.openai.com) for limits for your OpenAI Account
    - For Ollama, adjust the value as per capacity of machine running Ollama
- `--ai-endpoint`: Endpoint to use with AI models
    - Defaults to `https://api.openai.com/v1` for OpenAI
        - Some providers like xAI supported supported using OpenAI SDK to use their models. Refer to their docs to know latest updates
    - Defaults to `http://127.0.0.1:11434` for Ollama


## Launching interactive console
Now that the pentester has got the mappings of all the functions, they can now use interactive console. To launch it, they can add `-i`/`--interative` flag to the previous command
```bash
js-recon map -d output/app.example.com -t next --ai description -i
```

*This feature might look complex, so it is recommended to get an overview through the [Interactive Mode Docs](./interactive-mode.md) before reading further*

The pentester would first like to get the instances of `fetch()`, so that they can know the sites where an API call could be made. So, they will run the following command in interactive mode:
```
list fetch
```

This will list all the functions that have a fetch function. If the pentester had enabled the AI descriptions, then they could also see a brief of what the function does. Now, they can go to any function that seems suspicious
```
go to 1234
```
By running this command, the tool would clear the output of the interactive mode, and print the code of the function. The tool provides vim like interface and shortcuts. The user can scroll on the function to go either up or down. Also, they can press `Esc`, and then use the arrow keys to navigate. To focus again on the input box, they can press the `i` key. To quit the app, they can press `Esc` and then `q` or `Ctrl-c`

Since the pentester prefers to see the function code in the IDE of their choice, they can write this to a separate file. To do so, they can run the following command in the interactive mode:
```
set funcwritefile <filename>
```

Now, every time when the `go to <id>` command will be ran, the tool will write the code to the specified file. 
Once they open it in the IDE of their choice, they can go to the instances of fetch by finding it through `C-f` in the IDE. Once they find an instance, they could manually reverse engineer the full request.

To assist in doing the same, they used the following commands:
- `list all`: Lists all the functions, their descriptions, and the file they are found in
- `trace <functionName>`: This lists all the other function that the given function imports, as well as the functions to which this is being exported
    - For example, a function required to modify the UI, so it will import those function, and hence they will be listed as imports
    - This function is called at multiple places, which are listed as exports
- `go back`: This will take the pentester to the previous function they viewed
- `go ahead`: This will take the pentester to the next function they viewed (should work if they used `go back`)

## Run Module
If this process seems tidious (which it is), the pentester can use the `run` module of the tool. It will:
- [Download all the JS files](#downloading-js-files)
- [Find all the strings](#finding-strings)
- [Check for subsequent requests if required](#subseqent-requests)
- [Run string analysis again](#getting-more-with-strings-analysis)
- [Get all client-side endpoints](#getting-client-side-endpoints)
- [Map all the functions](#mapping-all-the-functions)

Here's what it will **NOT** do:
- Understand the output files to build a good attack vector
    - The pentester can fuzz the `paths` from the `strings` module on multiple hosts
    - They can see the UI on the client-side paths found by `endpoints` module
    - They can come up with new methods to get the most from the output of different modules
- Completely resolve all the requests (it would go as deep as possible, but couldn't fully resolve some requests as of writing this)

The docs for the `run` module can be found [here](./run.md)

The pentester could now automate the mentioned steps by running the following command:
```bash
js-recon run -u https://app.example.com --secrets --ai description
```