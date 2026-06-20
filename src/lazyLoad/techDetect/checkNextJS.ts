/**
 * Checks if a webpage uses Next.js by iterating through all HTML tags and checking if any src, srcset, or imageSrcSet attribute value starts with "/_next/".
 * @returns {Promise<{detected: boolean, evidence: string}>}
 *   A promise that resolves to an object with two properties:
 *   - detected: A boolean indicating whether Next.js was detected.
 *   - evidence: A string with the evidence of the detection, or an empty string
 *     if Next.js was not detected.
 */
export const checkNextJS = async ($) => {
    let detected = false;
    let evidence = "";

    // __NEXT_DATA__ script tag is injected by Next.js on every SSR/SSG page
    const nextDataEl = $("script#__NEXT_DATA__");
    if (nextDataEl.length > 0) {
        return { detected: true, evidence: "script#__NEXT_DATA__" };
    }

    // iterate through each HTML tag, check src, srcset, imageSrcSet, and href for /_next/
    $("*").each((_, el) => {
        if (detected) return;
        const tag = $(el).get(0).tagName;

        const src = $(el).attr("src");
        const srcSet = $(el).attr("srcset");
        const imageSrcSet = $(el).attr("imageSrcSet");
        const href = $(el).attr("href");

        if (src && src.includes("/_next/")) {
            detected = true;
            evidence = `${tag} :: ${src}`;
        } else if (srcSet && srcSet.includes("/_next/")) {
            detected = true;
            evidence = `${tag} :: ${srcSet}`;
        } else if (imageSrcSet && imageSrcSet.includes("/_next/")) {
            detected = true;
            evidence = `${tag} :: ${imageSrcSet}`;
        } else if (href && href.includes("/_next/")) {
            detected = true;
            evidence = `${tag} :: ${href}`;
        }
    });

    return { detected, evidence };
};
