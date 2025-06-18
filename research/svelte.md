# Svelte Research
## Tech Detection
Svelte framework can be detected by following methods:
- Elements would have the class name `svelte-*`
- Elements would have the ID `svelte-*`
- Elements would have the `data-sveltekit-reload` attribute

## Lazy Loaded Files
### Analysis of [Svelte.dev](https://svelte.dev/)
Upon inspecting the page source, it was found that `<link>` tags contained URLs to JS files. Those tags had an attribute `rel="modulepreload"`.

When those scripts were loaded, they loaded additional JS files, whose path were hardcoded in them as strings. Notably, the file at https://svelte.dev/_app/immutable/entry/app.D3g8JKVe.js had multiple JS files hardcoded in it as strings. It is advisable to scan all the JS files to get as much JS files as possible.

### Analysis of [Brave](https://brave.com/)
Brave had a different method for loading JS files. Most of the JS files were loaded via `<script>` tags.