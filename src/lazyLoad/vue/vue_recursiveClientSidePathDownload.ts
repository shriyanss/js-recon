import chalk from "chalk";
import vue_discoverJsFiles from "./vue_discoverJsFiles.js";

/**
 * Recursively walks newly discovered Vue.js client-side paths.
 *
 * For each path, runs the same discovery pipeline used on the entry URL
 * (via {@link vue_discoverJsFiles}), collects every JS file it finds and
 * queues any new client-side paths surfaced from those files. Paths are
 * tracked in a visited set so each URL is only processed once.
 */
const vue_recursiveClientSidePathDownload = async (clientSidePaths: string[]): Promise<string[]> => {
    const allJsFiles = new Set<string>();
    const visitedPaths = new Set<string>();
    let pending: string[] = [...new Set(clientSidePaths)];

    while (pending.length > 0) {
        const batch = pending.filter((p) => !visitedPaths.has(p));
        pending = [];

        if (batch.length === 0) break;

        console.log(chalk.cyan(`[i] Recursing through ${batch.length} client-side path(s)...`));

        for (const path of batch) {
            visitedPaths.add(path);

            try {
                const { jsFiles, clientSidePaths: newPaths } = await vue_discoverJsFiles(path);

                for (const file of jsFiles) {
                    allJsFiles.add(file);
                }

                for (const newPath of newPaths) {
                    if (!visitedPaths.has(newPath)) {
                        pending.push(newPath);
                    }
                }
            } catch (err) {
                console.log(
                    chalk.red(
                        `[!] Failed to recurse into ${path}: ${err instanceof Error ? err.message : String(err)}`
                    )
                );
            }
        }
    }

    if (allJsFiles.size > 0) {
        console.log(
            chalk.green(`[✓] Recursive client-side discovery yielded ${allJsFiles.size} JS file(s) across ${visitedPaths.size} path(s)`)
        );
    }

    return [...allJsFiles];
};

export default vue_recursiveClientSidePathDownload;
