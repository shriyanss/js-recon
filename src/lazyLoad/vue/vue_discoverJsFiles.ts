import chalk from "chalk";
import vue_pageSrc from "./vue_pageSrc.js";
import vue_runtimeJs from "./vue_RuntimeJs.js";
import vue_singleJsFileOnHome from "./vue_SingleJsFileOnHome.js";
import vue_severalJsFilesHome from "./vue_severalJsFilesHome.js";
import vue_jsImports from "./vue_jsImports.js";
import vue_reconstructSourceMaps from "./vue_reconstructSourceMaps.js";
import vue_getClientSidePaths from "./vue_getClientSidePaths.js";
import vue_viteMapDeps from "./vue_viteMapDeps.js";
import vue_stringJsFiles from "./vue_stringJsFiles.js";

export interface VueDiscoveryResult {
    jsFiles: string[];
    clientSidePaths: string[];
}

/**
 * Runs the full Vue.js JS-file discovery pipeline against a single URL.
 *
 * Combines all the per-URL discovery techniques (page source script tags,
 * runtime.js chunks, single/several JS files on home, import statements,
 * source-map reconstruction) into one reusable flow, and also surfaces the
 * client-side paths found in the discovered files so callers can recurse.
 *
 * @param onFilesDiscovered Called with each batch of newly found URLs so the
 *   caller can start downloading them immediately rather than waiting for the
 *   full pipeline to finish.
 */
const vue_discoverJsFiles = async (
    url: string,
    maxJsSizeMb: number = 2,
    onFilesDiscovered?: (files: string[]) => void
): Promise<VueDiscoveryResult> => {
    let jsFiles: string[] = [];

    const emit = (files: string[]) => {
        jsFiles.push(...files);
        if (files.length > 0 && onFilesDiscovered) {
            onFilesDiscovered(files.map((f) => (f.startsWith("//") ? "https:" + f : f)));
        }
    };

    // first, get all the JS files from the page source
    emit(await vue_pageSrc(url));

    // method 1: through runtime.<hash>.js
    emit(await vue_runtimeJs(url));

    // single JS file on the page (typically dev-mode)
    const fromSingleJs = await vue_singleJsFileOnHome(url);
    emit(fromSingleJs);
    if (fromSingleJs.length > 0) {
        console.log(chalk.green(`[✓] Found ${fromSingleJs.length} files from the single JS file on home`));
    }

    // several JS files referenced directly on the page
    emit(await vue_severalJsFilesHome(url));

    // scan page-loaded JS files for Vite's __vite__mapDeps chunk manifest
    const fromViteMapDeps = await vue_viteMapDeps(jsFiles, maxJsSizeMb);
    emit(fromViteMapDeps);
    if (fromViteMapDeps.length > 0) {
        console.log(chalk.green(`[✓] Found ${fromViteMapDeps.length} files from __vite__mapDeps`));
    }

    // walk the import graph of everything found so far
    const fromImports = await vue_jsImports(url, jsFiles, maxJsSizeMb);
    emit(fromImports);
    if (fromImports.length > 0) {
        console.log(chalk.green(`[✓] Found ${fromImports.length} files from import statements`));
    }

    // scan string literals inside known JS files for .js references
    const fromStringRefs = await vue_stringJsFiles(jsFiles, maxJsSizeMb);
    emit(fromStringRefs);
    if (fromStringRefs.length > 0) {
        console.log(chalk.green(`[✓] Found ${fromStringRefs.length} files from string literal JS references`));
    }

    // reconstruct sourceMappingURL references
    const fromSourceMaps = await vue_reconstructSourceMaps(url, jsFiles);
    emit(fromSourceMaps);
    if (fromSourceMaps.length > 0) {
        console.log(chalk.green(`[✓] Found ${fromSourceMaps.length} files from reconstructing source maps`));
    }

    jsFiles = [...new Set(jsFiles)].map((f) => (f.startsWith("//") ? "https:" + f : f));

    // surface client-side paths so the caller can recurse into them
    const clientSidePaths = await vue_getClientSidePaths(url, jsFiles, maxJsSizeMb);

    return { jsFiles, clientSidePaths: [...new Set(clientSidePaths)] };
};

export default vue_discoverJsFiles;
