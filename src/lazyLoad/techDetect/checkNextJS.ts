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
    // iterate through each HTML tag, and file tag value that starts with `/_next/`
    $("*").each((_, el) => {
        const tag = $(el).get(0).tagName;

        // check the value of three attributes
        const src = $(el).attr("src");
        const srcSet = $(el).attr("srcset");
        const imageSrcSet = $(el).attr("imageSrcSet");

        if (src || srcSet || imageSrcSet) {
            if (src && src.includes("/_next/")) {
                detected = true;
                evidence = `${tag} :: ${src}`;
            } else if (srcSet && srcSet.includes("/_next/")) {
                detected = true;
                evidence = `${tag} :: ${srcSet}`;
            } else if (imageSrcSet && imageSrcSet.includes("/_next/")) {
                detected = true;
                evidence = `${tag} :: ${imageSrcSet}`;
            }
        }
    });

    return { detected, evidence };
};
