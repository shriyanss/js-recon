/**
 * Source Map Decoder
 *
 * Extracts original source code from minified JavaScript using source maps.
 */

/**
 * Source map JSON structure (v3)
 */
export interface SourceMap {
    version: number;
    file?: string;
    sourceRoot?: string;
    sources: string[];
    sourcesContent?: (string | null)[];
    names?: string[];
    mappings: string;
}

/**
 * Extracted source file
 */
export interface SourceFile {
    /** Original file path from the source map */
    path: string;
    /** Original source code content */
    content: string;
}

/**
 * Result of extracting sources from a source map
 */
export interface ExtractResult {
    /** Array of extracted source files */
    files: SourceFile[];
    /** Number of sources that had no content (sourcesContent was null) */
    missingCount: number;
}

/**
 * Options for extracting source files
 */
export interface ExtractOptions {
    /** Remove webpack:// and similar protocol prefixes from paths (default: true) */
    cleanPaths?: boolean;
    /** Normalize ../ sequences in paths (default: true) */
    normalizePaths?: boolean;
}

/**
 * Extract original source files from a source map.
 *
 * @param sourceMap - The source map object or JSON string
 * @param options - Optional configuration
 * @returns Object containing extracted files and count of missing sources
 *
 * @example
 * ```typescript
 * import { extractSources } from './sourcemap';
 *
 * const sourceMap = {
 *   version: 3,
 *   sources: ['src/app.ts', 'src/utils.ts'],
 *   sourcesContent: ['const x = 1;', 'export const y = 2;'],
 *   mappings: '...',
 * };
 *
 * const result = extractSources(sourceMap);
 * for (const file of result.files) {
 *   console.log(`${file.path}:\n${file.content}`);
 * }
 * ```
 */
export function extractSources(sourceMap: SourceMap | string, options: ExtractOptions = {}): ExtractResult {
    const { cleanPaths = true, normalizePaths = true } = options;

    // Parse JSON string if needed
    const map: SourceMap = typeof sourceMap === "string" ? JSON.parse(sourceMap) : sourceMap;

    // Validate source map
    if (!map.sources || !Array.isArray(map.sources)) {
        throw new Error('Invalid source map: missing "sources" array');
    }

    const files: SourceFile[] = [];
    let missingCount = 0;

    for (let i = 0; i < map.sources.length; i++) {
        let path = map.sources[i];
        const content = map.sourcesContent?.[i];

        // Skip if no content
        if (content === null || content === undefined) {
            missingCount++;
            continue;
        }

        // Clean up path
        if (cleanPaths) {
            path = cleanPath(path);
        }
        if (normalizePaths) {
            path = normalizePath(path);
        }

        // Apply sourceRoot if present
        if (map.sourceRoot && !path.startsWith("/")) {
            const root = cleanPaths ? cleanPath(map.sourceRoot) : map.sourceRoot;
            path = joinPaths(root, path);
        }

        files.push({ path, content });
    }

    return { files, missingCount };
}

/**
 * Extract a single source file by index or path.
 *
 * @param sourceMap - The source map object or JSON string
 * @param indexOrPath - Index into sources array or file path to find
 * @returns The source file or null if not found
 */
export function extractSource(sourceMap: SourceMap | string, indexOrPath: number | string): SourceFile | null {
    const map: SourceMap = typeof sourceMap === "string" ? JSON.parse(sourceMap) : sourceMap;

    if (typeof indexOrPath === "number") {
        const index = indexOrPath;
        if (index < 0 || index >= map.sources.length) {
            return null;
        }
        const content = map.sourcesContent?.[index];
        if (content === null || content === undefined) {
            return null;
        }
        return { path: map.sources[index], content };
    }

    // Search by path
    const searchPath = indexOrPath;
    const index = map.sources.findIndex(
        (s) =>
            s === searchPath ||
            s.endsWith(searchPath) ||
            cleanPath(s) === searchPath ||
            cleanPath(s).endsWith(searchPath)
    );

    if (index === -1) {
        return null;
    }

    const content = map.sourcesContent?.[index];
    if (content === null || content === undefined) {
        return null;
    }

    return { path: map.sources[index], content };
}

/**
 * Get list of source file paths without extracting content.
 *
 * @param sourceMap - The source map object or JSON string
 * @returns Array of source file paths
 */
export function listSources(sourceMap: SourceMap | string): string[] {
    const map: SourceMap = typeof sourceMap === "string" ? JSON.parse(sourceMap) : sourceMap;

    return map.sources || [];
}

/**
 * Check if a source map has embedded source content.
 *
 * @param sourceMap - The source map object or JSON string
 * @returns true if sourcesContent is present and has at least one non-null entry
 */
export function hasSourceContent(sourceMap: SourceMap | string): boolean {
    const map: SourceMap = typeof sourceMap === "string" ? JSON.parse(sourceMap) : sourceMap;

    return Array.isArray(map.sourcesContent) && map.sourcesContent.some((c) => c !== null && c !== undefined);
}

/**
 * Remove protocol prefixes like webpack://, file://, etc.
 */
function cleanPath(path: string): string {
    return path
        .replace(/^webpack:\/\/[^/]*\//, "") // webpack://package-name/
        .replace(/^webpack:\/\//, "") // webpack://
        .replace(/^file:\/\//, "") // file://
        .replace(/^\.\//, ""); // ./
}

/**
 * Normalize path by resolving ../ sequences.
 * SECURITY: Removes all leading ../ to prevent directory traversal attacks.
 * Files will always stay within the intended output directory.
 */
function normalizePath(path: string): string {
    const parts = path.split("/");
    const result: string[] = [];

    for (const part of parts) {
        if (part === "..") {
            // Only allow going back within the path we've built
            // Never allow escaping (result would go negative)
            if (result.length > 0) {
                result.pop();
            }
            // If result is empty, just skip the '..' entirely (prevents traversal)
        } else if (part !== "." && part !== "") {
            result.push(part);
        }
    }

    return result.join("/") || ".";
}

/**
 * Sanitize a path to ensure it cannot escape the output directory.
 * This is a safety check that should be used before writing files.
 *
 * @param basePath - The base output directory (absolute path)
 * @param filePath - The file path to sanitize
 * @returns Safe path that is guaranteed to be under basePath
 */
export function safePath(basePath: string, filePath: string): string {
    // Clean and normalize the file path
    let cleaned = cleanPath(filePath);
    cleaned = normalizePath(cleaned);

    // Remove any remaining ../ sequences (belt and suspenders)
    cleaned = cleaned.replace(/\.\.\//g, "").replace(/^\.\.$/, "");

    // Remove leading slashes to prevent absolute path injection
    cleaned = cleaned.replace(/^\/+/, "");

    // Join with base path
    const joined = basePath.endsWith("/") ? basePath + cleaned : basePath + "/" + cleaned;

    return joined;
}

/**
 * Join two path segments
 */
function joinPaths(base: string, path: string): string {
    if (!base) return path;
    if (!path) return base;

    const baseClean = base.endsWith("/") ? base.slice(0, -1) : base;
    const pathClean = path.startsWith("/") ? path.slice(1) : path;

    return `${baseClean}/${pathClean}`;
}

// Default export for convenience
export default { extractSources, extractSource, listSources, hasSourceContent };
