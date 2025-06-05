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

Also, it was found that very less URLs were present in the `webpack.js` file (4 at the time of analysis). Upon further inspection, it was found that the URLs are present in the inline `<script>` tags returned in the page source. For example:
```
self.__next_f.push([1,"14:I[41498,[\"3867\",\"static/chunks/b6d67c9f-618ea7c61a79562d.js\",\"5017\",\"static/chunks/622eaf3d-350d2142e11f9e13.js\",\"1889\",\"static/chunks/0fd4459a-4e25f772815e6f19.js\",\"4406\",\"static/chunks/4406-fdbbb31c90e98725.js\",\"8627\",\"static/chunks/8627-54829c23d6b1a53f.js\",\"6520\",\"static/chunks/6520-f51ddcfa4e30ebc8.js\",\"1296\",\"static/chunks/1296-b8c2dd03773a40db.js\",\"8922\",\"static/chunks/8922-f01acc4fc5fecfad.js\",\"6929\",\"static/chunks/6929-a636a59ffdb51b17.js\",\"2601\"......snip....../chunks/b6d67c9f-"])
```

To handle this, a feature was implemented to get the JS files from the inline `<script>` tags as well.