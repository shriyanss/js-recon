/**
 * Detects if a webpage uses Svelte/SvelteKit by checking for Svelte-specific attributes.
 *
 * Looks for svelte- prefixed class names, IDs, and SvelteKit-specific attributes
 * like data-sveltekit-reload to identify Svelte applications.
 *
 * @param $ - The Cheerio API object containing the parsed HTML
 * @returns Promise that resolves to an object with detection status and evidence
 */
export const checkSvelte = async ($) => {
    let detected = false;
    let evidence = "";

    // go through the page source, and check for all the class names of all HTML tags
    $("*").each((_, el) => {
        const tag = $(el).get(0).tagName;
        const attribs = el.attribs;
        if (attribs) {
            for (const [attrName, attrValue] of Object.entries(attribs)) {
                if (attrName === "class") {
                    // @ts-ignore
                    if (attrValue.includes("svelte-")) {
                        detected = true;
                        evidence = `${attrName} :: ${attrValue}`;
                    }
                }
            }
        }
    });

    // now, search for the svelte- id of all elements
    $("*").each((_, el) => {
        const tag = $(el).get(0).tagName;
        const attribs = el.attribs;
        if (attribs) {
            for (const [attrName, attrValue] of Object.entries(attribs)) {
                if (attrName === "id") {
                    // @ts-ignore
                    if (attrValue.includes("svelte-")) {
                        detected = true;
                        evidence = `${attrName} :: ${attrValue}`;
                    }
                }
            }
        }
    });

    // now, check for the data-sveltekit-reload attribute
    $("*").each((_, el) => {
        const tag = $(el).get(0).tagName;
        const attribs = el.attribs;
        if (attribs) {
            for (const [attrName, attrValue] of Object.entries(attribs)) {
                if (attrName === "data-sveltekit-reload") {
                    detected = true;
                    evidence = `${attrName} :: ${attrValue}`;
                }
            }
        }
    });

    return { detected, evidence };
};
