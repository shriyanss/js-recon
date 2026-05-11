import chalk from "chalk";
import vue_pageSrc from "./vue_pageSrc.js";
import vue_runtimeJs from "./vue_RuntimeJs.js";
import vue_singleJsFileOnHome from "./vue_SingleJsFileOnHome.js";
import vue_severalJsFilesHome from "./vue_severalJsFilesHome.js";
import vue_jsImports from "./vue_jsImports.js";
import vue_reconstructSourceMaps from "./vue_reconstructSourceMaps.js";
import vue_getClientSidePaths from "./vue_getClientSidePaths.js";

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
 */
const vue_discoverJsFiles = async (url: string, maxJsSizeMb: number = 2): Promise<VueDiscoveryResult> => {
    let jsFiles: string[] = [];

    // first, get all the JS files from the page source
    const fromPageSrc = await vue_pageSrc(url);
    jsFiles.push(...fromPageSrc);

    // method 1: through runtime.<hash>.js
    const fromRuntimeJs = await vue_runtimeJs(url);
    jsFiles.push(...fromRuntimeJs);

    // single JS file on the page (typically dev-mode)
    const fromSingleJs = await vue_singleJsFileOnHome(url);
    jsFiles.push(...fromSingleJs);
    if (fromSingleJs.length > 0) {
        console.log(chalk.green(`[✓] Found ${fromSingleJs.length} files from the single JS file on home`));
    }

    // several JS files referenced directly on the page
    const fromSeveralJs = await vue_severalJsFilesHome(url);
    jsFiles.push(...fromSeveralJs);

    // walk the import graph of everything found so far
    const fromImports = await vue_jsImports(url, jsFiles, maxJsSizeMb);
    jsFiles.push(...fromImports);
    if (fromImports.length > 0) {
        console.log(chalk.green(`[✓] Found ${fromImports.length} files from import statements`));
    }

    // reconstruct sourceMappingURL references
    const fromSourceMaps = await vue_reconstructSourceMaps(url, jsFiles);
    jsFiles.push(...fromSourceMaps);
    if (fromSourceMaps.length > 0) {
        console.log(chalk.green(`[✓] Found ${fromSourceMaps.length} files from reconstructing source maps`));
    }

    jsFiles = [...new Set(jsFiles)];

    // surface client-side paths so the caller can recurse into them
    const clientSidePaths = await vue_getClientSidePaths(url, jsFiles, maxJsSizeMb);

    return { jsFiles, clientSidePaths: [...new Set(clientSidePaths)] };
};

export default vue_discoverJsFiles;
