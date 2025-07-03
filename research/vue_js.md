# Vue.js Research

## Tech Detection

To detect Vue.js, following technique(s) can be used:

- Load the webpage in the browser, and find the `data-v-*` attribute
    - Note that this attribute might NOT be present if the webpage is not loaded in the browser, i.e. by directly getting the page source
- However, it was found that most of the Vue.JS sites were using Nuxt. The research for this can be found at [Nuxt.js Research](./nuxt_js.md)

## Lazy Loaded Files

### Analysis of [Vue.JS official site](https://vuejs.org/)
