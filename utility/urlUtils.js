/**
 * Extracts the host and directory path from a given URL.
 *
 * @param {string} url - The URL to be processed.
 * @returns {Object} An object containing:
 *   - host: The hostname of the URL (e.g., "vercel.com" or "localhost:3000").
 *   - directory: The directory path, excluding the filename if present (e.g., "/static/js").
 */
const getURLDirectory = (url) => {
  const u = new URL(url);
  const pathname = u.pathname;

  // Remove filename (last part after final /) if it ends with .js or any file extension
  const dir = pathname.replace(/\/[^\/?#]+\.[^\/?#]+$/, "");

  return {
    host: u.host, // e.g., "vercel.com" or "localhost:3000"
    directory: dir, // e.g., "/static/js"
  };
};

export { getURLDirectory };
