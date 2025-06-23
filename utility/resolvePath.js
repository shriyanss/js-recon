/**
 * Resolves a given path against a base URL using the URL constructor.
 *
 * The function handles various cases of path resolution:
 * - If the base URL does not end with a '/', its last segment is treated as a "file",
 *   and relative paths are resolved from its "directory".
 * - Examples:
 *   - url='https://site.com/something', path='./main.js' => 'https://site.com/main.js'
 *     (Base for resolution becomes 'https://site.com/')
 *   - url='https://site.com/something/', path='./main.js' => 'https://site.com/something/main.js'
 *     (Base for resolution is 'https://site.com/something/')
 *   - url='https://site.com/something/other', path='../main.js' => 'https://site.com/main.js'
 *     (Base for resolution becomes 'https://site.com/something/', then '../' navigates up)
 *
 * @param {string} url - The base URL to resolve against.
 * @param {string} path - The path to resolve.
 * @returns {Promise<string>} - A promise that resolves to the fully resolved URL as a string.
 * @throws Will throw an error if the resolution fails.
 */
const resolvePath = (url, path) => {
  try {
    // The URL constructor handles various cases of path resolution.
    // If 'url' (the base URL) does not end with a '/', its last path segment
    // is typically treated as a "file", and relative paths are resolved
    // from the "directory" containing that "file".
    // This behavior aligns with the provided examples:
    // - url='https://site.com/something', path='./main.js' => 'https://site.com/main.js'
    //   (Base for resolution becomes 'https://site.com/')
    // - url='https://site.com/something/', path='./main.js' => 'https://site.com/something/main.js'
    //   (Base for resolution is 'https://site.com/something/')
    // - url='https://site.com/something/other', path='../main.js' => 'https://site.com/main.js'
    //   (Base for resolution becomes 'https://site.com/something/', then '../' navigates up)
    const resolvedUrl = new URL(path, url);
    return resolvedUrl.href;
  } catch (e) {
    console.error(`Error resolving path "${path}" with base URL "${url}": ${e.message}`);
    // Rethrowing the error to signal failure to the caller.
    // Alternative error handling (e.g., returning null) can be implemented if required.
    throw e;
  }
};

export default resolvePath;
