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
The most common way to bypass this is to use a browser environment, such as a headless browser.

To achive this task, a detection mechanism is added in the custom function to make HTTP requests. If CF is detected, it will load the page in a headless browser, and then return the content.