# Next.js Research
## Tech Detection
To detect Next.js, following techniques can be used: 
- Iterate through all the HTML tags, and find `src`, `srcSet` or `imageSrcSet` attribute with value starting with`/_next/` in the page source

## Embedded JS files
A lot of JS files were identified from the page source by inspecting the value of `src` attribute of `script` tags. These included files like `main.js`, `polyfills.js`, `webpack.js` etc.

## Lazy Loaded files
### Analysis of [Vercel Docs](https://vercel.com/docs)
Upon analysis of page source and HTTP requests, it was found that the webpack filename had a pattern of `webpack-<hash>.js`. So, webpack JS files were identified and fetched.

Upon inspection of the webpack JS file, it was found that code was distributed into several functions. It was observed that the function responsible for returning the JS path ended with `".js"`. This observation was seen multiple times in the Next.js apps by the developer (aka web researcher), hence it bacame a standard method to get the path of the JS files.

### Analysis of [X.ai](https://x.ai)
It was found that most of the things were done in a similar way, however, some extra chars were present after `".js"` in the function responsible for returning JS path in the webpack JS file.

To handle this, the regex was modified to also include some additional characters at the end.
```js
.match(/"\.js".{0,15}$/)
```