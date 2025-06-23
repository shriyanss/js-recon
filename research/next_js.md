# Next.js Research
## Tech Detection
To detect Next.js, following technique(s) can be used: 
- Iterate through all the HTML tags, and find `src`, `srcSet` or `imageSrcSet` attribute with value starting with`/_next/` in the page source

## Embedded JS files
A lot of JS files were identified from the page source by inspecting the value of `src` attribute of `script` tags. These included files like `main.js`, `polyfills.js`, `webpack.js` etc.

## Lazy Loaded Files
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

Upon researching further, it was found that additional JS files were being returned in the subsequent HTTP requests. For example, the file at `https://x.ai/_next/static/chunks/app/careers/page-9e04dce6fed05790.js` was loaded from a request to `https://x.ai/careers?_rsc=jwl50`.

Request to `https://x.ai/careers?_rsc=jwl50` should be made with a special header called `RSC: 1` in order to get access to additional JS file paths. This request can be also sent to `/` with the same header to get more files.

Possible solution: To handle this, the strings can be extracted from the page sources, and then requests to them can be made along with this request header. If it returns a `200 OK`, then it can be also added to the list of JS files. 

### Analysis of [OpenAI](https://openai.com)
Upon inspection of HTTP requests, a similar behavior of sending the requests with `RSC: 1` header to get additional JS files was found.

However, a slight difference was found. When sending the request to `/business` with the same header, the server returned a different (`308 Permanent Redirect` to `/business/`) response. This can be handled by sending the request to `/business/` with the same header.

Additionally, it was noticed that when the requests were sent without the `RSC: 1` header, the request got blocked by Cloudflare, and it resulted in a `403 Forbidden` response with a message `Just a moment...`. This could indicate a potential firewall bypass

## Client-Side Paths/URLs
Client-side paths/URLs are web addresses handled by the browser using JavaScript, usually without reloading the page. They are used for navigation, API requests, and loading resources dynamically within the client environment.

### Analysis of [X.ai](https://x.ai)
Upon inspection of the client side paths, it was found that they are present in `href` across JS chunks.

These are a part of a list, which contains objects with keys like `href` (string), `label` (string), `active` (boolean) and `children` (array of objects of the same type).

For instance, here's a example of such a list:
```js
let L = [
    {
      href: "/grok",
      label: "Grok",
      active: e.startsWith("/grok"),
      children: [
        { href: "/grok", label: "For Everyone", active: "/grok" == e },
        {
          href: "/grok/business",
          label: "For Business",
          active: "/grok/business" == e,
        },
      ],
    },
    {
      href: "/api",
      label: "API",
      active: e.startsWith("/api"),
      children: [
        { href: "/api#capabilities", label: "Overview" },
        {
          href: "https://docs.x.ai/docs/models?cluster=us-east-1#detailed-pricing-for-all-grok-models",
          label: "Pricing",
          external: !0,
        },
        {
          href: "https://console.x.ai",
          label: "API Console Login",
          external: !0,
        },
        {
          href: "https://docs.x.ai",
          label: "Documentation",
          external: !0,
        },
      ],
    },
    { href: "/company", label: "Company", active: "/company" == e },
    { href: "/colossus", label: "Colossus", active: "/colossus" == e },
    {
      href: "/careers",
      label: "Careers",
      active: e.startsWith("/careers"),
    },
    { href: "/news", label: "News", active: e.startsWith("/news") },
]
```

Possible methodology: The tool can iterate over all the JS chunks, and find the list of objects with keys like `href` (string), `label` (string), `active` (boolean) and `children` (array of objects of the same type). Then, it can organize them in a report.

Additionally, upon inspecting the files in the `__subsequent_requests` subdirectory, it was found that they also had the same URLs. The number of files to parse in that case is significantly less, however, those files aren't JavaScript files. They are `text/x-component` (content-type header) files.

### Analyis of [1Password](https://1password.com)
It was found that the client-side paths were stored in mostly stored in a way like:
```js
let s = JSON.parse(
          '["/state-of-enterprise-security-report/thank-you/",......"/webinars/1p-quarterly-security-spotlight-and-roadmap-review/thank-you/"]',
)
```

Some similar pattern was also observed in [OpenAI](https://openai.com), however, the full analysis of OpenAI's client-side paths is not done at the time of writing this.

It was also found that some paths were stored directly as a list. For example:
```js
let n = ["/pricing/xam", "/pricing/password-manager"];
```

### Analysis of [OpenAI](https://openai.com)
Upon inspection of subsequent requests file, multiple patterns were discovered. The response returned by the server on requesting an endpoint with the `RSC: 1` header had a content type of `text/x-component`. This meant that this couldn't be parsed directly with a JS parser. Upon inspecting the contents of those files, it was found that every line of it contained a valid JS code. The following pattern was uncovered:
- If a line started with `^[0-9a-z]+:I\[.+` (examples of valid matches: `1d:I[`, `23:I[`, `24:I[`, etc.), then that line contained paths to JS chunks
- If a line started with `^[0-9a-z]+:\[.+` (examples of valid matches: `1d:[`, `23:[`, `24:[`, etc.), then that line contained valid JS code between `[` and `]`

Moreover, it must be noted that the value of contents of a line could be also null, undefined, or something else, for example, `1:null`. These lines should be ignored.
