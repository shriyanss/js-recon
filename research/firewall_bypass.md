# Firewall Bypass
While the development of this tool, the tester came across several websites using firewall, majorly Cloudflare. A technique has to be developed to bypass this blockage, and to download the JS files.

## Cloudflare
### Detection
Whenever the client is restricted by Cloudflare, it returns a HTML page with a JS challenge to be solved. However, the JS is can't be executed by Node.JS. It would need a browser environment. Sample HTML page is shown below:

```html
<meta http-equiv="refresh"
        content="5; URL='/?bm-verify=--snip--'" />
--snip--
<script> var i = 1749580415; var j = i + Number("7341" + "47171"); </script>
--snip--
<script> var xhr = new XMLHttpRequest(); xhr.withCredentials = true; xhr.addEventListener("loadend", function () { try { var data = JSON.parse(xhr.responseText); if (data.hasOwnProperty('reload')) { if (data["reload"] == true) { window.location.replace(window.location.href.replace(/[&?]bm-verify=[^#]*/, "")); if (window.location.hash) { window.location.reload(); } } } else if (data.hasOwnProperty(--snip </script>
```

### Bypass
#### #1
The most common way to bypass this is to use a browser environment, such as a headless browser.

To achive this task, a detection mechanism is added in the custom function to make HTTP requests. If CF is detected, it will load the page in a headless browser, and then return the content.

#### #2
Utilizing a browser plugin to fetch the contents is a more advanced way to bypass this. The user can install the plugin in their testing browser/proxy, and as they navigate the site, the plugin will get the contents and send then to the server for processing (it would be like a caching system).

#### #3
The `makeRequest()` can be modified to send headers that a browser would send. These include:
- `User-Agent` of a browser
- `Accept`
- `Accept-Language`
- `Sec-Fetch-Site: same-origin`
- `Sec-Fetch-Mode: cors`
- `Sec-Fetch-Dest: empty`
- `Referer`
- `Origin`

#### #4
Utilizing AWS API Gateway or similar services to rotate IP addresses can help in bypassing the firewall. This, however, could be blocked by the by CF if it is configured to block requests from AWS or similar ISPs.