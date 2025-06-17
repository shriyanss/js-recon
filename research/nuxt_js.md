# Nuxt.js Research
## Tech Detection
Nuxt.js is a framework based on Vue.js. So, if the Vue.js is detected, then it is essential to detect Nuxt.js for accuracy.

To detect Nuxt.js, following technique(s) can be used: 
- Search for "/_nuxt" in following attributes
    - `src`, `href`

## Lazy Loaded Files
### Analysis of [GitLab's About Site](https://about.gitlab.com/)
It was found that all of the JS files were loaded from the `/_nuxt-new` directory instead of `/_nuxt` directory. The path to the JS files were located in the `<link>` tags' `href` attribute. These `<link>` tags had the value of `rel` attribute as `modulepreload`, and the values of `as` attribute as `script`.

Additionally, there were some `<script>` tags found with `src` attribute as the path to the JS files, which started with `/_nuxt`.

### Analysis of [Vue Mastery](https://www.vuemastery.com/)
Similar to Gitlab's About Page, Vue Mastery had `<link>` tags with `rel` attribute as `preload` and `href` attribute as the path to the JS files. These `<link>` tags had the value of `as` attribute as `script`, which is common between two sites.

Additionally, there were some `<script>` tags found with `src` attribute as the path to the JS files, which started with `/_nuxt`.

## Client-Side Paths/URLs
### Analysis of [GitLab's About Site](https://about.gitlab.com/)
It was found that the client-side paths/URLs were present in the https://about.gitlab.com/_nuxt-new/builds/meta/2d555104-4dad-4b33-a02f-128a966a0c7b.json file. This file was found in the following tab on the home page's source code:
```html
<link rel="preload" as="fetch" fetchpriority="low" crossorigin="anonymous" href="/_nuxt-new/builds/meta/2d555104-4dad-4b33-a02f-128a966a0c7b.json">
```

Here's a preview of the JSON file:
```json
{
    "id": "2d555104-4dad-4b33-a02f-128a966a0c7b",
    "timestamp": 1750133987484,
    "matcher": {
        "static": {},
        "wildcard": {},
        "dynamic": {}
    },
    "prerendered": [
        "/de-de/contact-sales",
        "/de-de/get-help",
        --snip--
        "/contact-sales",
        "/analysts",
        --snip
        "/ja-jp",
        "/ja-jp/search",
        "/",
        "/search"
    ]
}
```