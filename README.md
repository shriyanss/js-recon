# js-recon
## Installation
To install all the required modules, run:
```bash
npm i
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