/**
 * Given a URL, returns an object with the host and directory
 * of the URL. The directory is the path of the URL after the
 * host, and the filename is removed if it ends with a file extension.
 * For example, given "https://vercel.com/static/js/main.js", it will return
 * an object with host "vercel_com" and directory "/static/js".
 * @param {string} url - The URL to parse.
 * @returns {Object} An object with the host and directory of the URL.
 */
const getURLDirectory = (url: string) => {
    const u = new URL(url);
    const pathname = u.pathname;

    // Remove filename (last part after final /) if it ends with .js or any file extension
    const dir = pathname.replace(/\/[^\/?#]+\.[^\/?#]+$/, "");

    return {
        host: u.host.replace(":", "_"), // e.g., "vercel.com" or "localhost_3000"
        directory: dir, // e.g., "/static/js"
    };
};

export { getURLDirectory };
