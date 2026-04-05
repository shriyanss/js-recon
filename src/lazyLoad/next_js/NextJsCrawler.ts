import chalk from "chalk";
import { URL } from "url";

import next_getJSScript from "./next_GetJSScript.js";
import next_GetLazyResourcesWebpackJs from "./next_GetLazyResourcesWebpackJs.js";
import next_getLazyResourcesBuildManifestJs from "./next_GetLazyResourcesBuildManifestJs.js";
import subsequentRequests from "./next_SubsequentRequests.js";
import next_promiseResolve from "./next_promiseResolve.js";
import next_parseLayoutJs from "./next_parseLayoutJs.js";
import next_scriptTagsSubsequentRequests from "./next_scriptTagsSubsequentRequests.js";
import next_bruteForceJsFiles from "./next_bruteForceJsFiles.js";

import * as lazyLoadGlobals from "../globals.js";

interface NextJsCrawlerOptions {
    url: string;
    output: string;
    subsequentRequestsFlag: boolean;
    urlsFile: string;
    threads: number;
    research: boolean;
    maxIterations: number;
}

/**
 * Encapsulates the Next.js JS file discovery logic with recursive crawling.
 *
 * After running all discovery methods once, the crawler re-runs path-sensitive
 * methods (promiseResolve, parseLayoutJs, getJSScript) on any *newly* found
 * URLs until no new JS files are discovered, ensuring full coverage.
 */
class NextJsCrawler {
    private readonly url: string;
    private readonly output: string;
    private readonly subsequentRequestsFlag: boolean;
    private readonly urlsFile: string;
    private readonly threads: number;
    private readonly research: boolean;

    /** All JS/JSON URLs discovered so far (deduplicated). */
    private discoveredUrls: Set<string>;

    /** Page URLs that have already been visited for script-tag extraction. */
    private visitedPageUrls: Set<string>;

    /** Per-technique efficiency mapping (for research mode). */
    public techniqueEfficiencyMapping: Record<string, string[]>;

    /** Maximum number of recursive passes before giving up. */
    private MAX_ITERATIONS: number;

    constructor(options: NextJsCrawlerOptions) {
        this.url = options.url;
        this.output = options.output;
        this.subsequentRequestsFlag = options.subsequentRequestsFlag;
        this.urlsFile = options.urlsFile;
        this.threads = options.threads;
        this.research = options.research;
        this.MAX_ITERATIONS = options.maxIterations;

        this.discoveredUrls = new Set();
        this.visitedPageUrls = new Set();
        this.techniqueEfficiencyMapping = {};
    }

    // ── helpers ──────────────────────────────────────────────────────────

    /** Register newly found URLs and return only the ones that are truly new. */
    private registerUrls(urls: string[]): string[] {
        const newUrls: string[] = [];
        for (const u of urls) {
            if (!this.discoveredUrls.has(u)) {
                this.discoveredUrls.add(u);
                newUrls.push(u);
            }
        }
        return newUrls;
    }

    /** Snapshot the current size so we can detect growth. */
    private get size(): number {
        return this.discoveredUrls.size;
    }

    // ── initial discovery (run-once methods) ─────────────────────────────

    /**
     * Runs the heavyweight / one-shot discovery methods that only need to
     * execute once (puppeteer-based webpack analysis, build-manifest, etc.).
     */
    private async initialDiscovery(): Promise<void> {
        // 1. Script tags on the landing page
        const jsFromScriptTag = await next_getJSScript(this.url);
        this.techniqueEfficiencyMapping["next_getJSScript"] = jsFromScriptTag;
        this.registerUrls(jsFromScriptTag);
        this.visitedPageUrls.add(this.url);

        // 2. Webpack runtime analysis (puppeteer – expensive, run once)
        const jsFromWebpack = await next_GetLazyResourcesWebpackJs(this.url);
        this.techniqueEfficiencyMapping["next_GetLazyResourcesWebpackJs"] = jsFromWebpack;
        lazyLoadGlobals.pushToJsUrls(jsFromWebpack);
        this.registerUrls(jsFromWebpack);

        // 3. _buildManifest.js
        const jsFromBuildManifest = await next_getLazyResourcesBuildManifestJs(this.url);
        this.techniqueEfficiencyMapping["next_getLazyResourcesBuildManifestJs"] = jsFromBuildManifest;
        lazyLoadGlobals.pushToJsUrls(jsFromBuildManifest);
        this.registerUrls(jsFromBuildManifest);

        // 4. Subsequent requests (RSC / script-tags on known endpoints)
        if (this.subsequentRequestsFlag) {
            const jsFromSubsequent = await subsequentRequests(
                this.url,
                this.urlsFile,
                this.threads,
                this.output,
                lazyLoadGlobals.getJsUrls()
            );
            this.techniqueEfficiencyMapping["subsequentRequests"] = [...jsFromSubsequent];
            this.registerUrls([...jsFromSubsequent]);

            const jsFromScriptTagsSR = await next_scriptTagsSubsequentRequests(this.url, this.urlsFile);
            this.techniqueEfficiencyMapping["next_scriptTagsSubsequentRequests"] = jsFromScriptTagsSR;
            lazyLoadGlobals.pushToJsUrls(jsFromScriptTagsSR);
            this.registerUrls(jsFromScriptTagsSR);
        }

        // Also pull in anything the globals accumulated
        this.registerUrls(lazyLoadGlobals.getJsUrls());
        this.registerUrls(lazyLoadGlobals.getJsonUrls());
    }

    // ── recursive discovery ──────────────────────────────────────────────

    /**
     * Runs the lightweight methods that can discover *more* URLs from an
     * existing set of JS file URLs. These are cheap enough to repeat.
     *
     * @param jsUrls The JS URLs to analyse in this pass.
     * @returns Newly discovered URLs in this pass.
     */
    private async recursivePass(jsUrls: string[]): Promise<string[]> {
        let newInThisPass: string[] = [];

        // Promise.all pattern analysis on JS file contents
        const jsFromPromise = await next_promiseResolve(jsUrls);
        this.techniqueEfficiencyMapping["next_promiseResolve"] = [
            ...(this.techniqueEfficiencyMapping["next_promiseResolve"] || []),
            ...jsFromPromise,
        ];
        newInThisPass.push(...this.registerUrls(jsFromPromise));

        // Layout.js parsing → discovers new client-side page paths → visits them
        const jsFromLayout = await next_parseLayoutJs(this.url, jsUrls);
        this.techniqueEfficiencyMapping["next_parseLayoutJs"] = [
            ...(this.techniqueEfficiencyMapping["next_parseLayoutJs"] || []),
            ...jsFromLayout,
        ];
        newInThisPass.push(...this.registerUrls(jsFromLayout));

        // For every new page URL that parseLayoutJs may have visited,
        // also run getJSScript to pick up script tags we haven't seen.
        // We detect "page URLs" as non-.js URLs in the new set.
        for (const u of newInThisPass) {
            let parsed: URL;
            try {
                parsed = new URL(u);
            } catch {
                // invalid URL, skip
                continue;
            }

            const isJsFile = parsed.pathname.endsWith(".js") || parsed.pathname.endsWith(".js.map");
            if (!isJsFile && !this.visitedPageUrls.has(u)) {
                this.visitedPageUrls.add(u);
                
                const extra = await next_getJSScript(u);
                
                // If return value is invalid, log and crash
                if (!extra || !Array.isArray(extra)) {
                    console.error(`[NextJsCrawler] Invalid return value from next_getJSScript for URL: ${u}`);
                    console.error(`[NextJsCrawler] Returned value:`, extra);
                    process.exit(1);
                }
                
                newInThisPass.push(...this.registerUrls(extra));
            }
        }

        return newInThisPass;
    }

    // ── public API ───────────────────────────────────────────────────────

    /**
     * Main entry-point.  Runs initial discovery, then iterates recursive
     * passes until convergence (no new URLs) or the iteration cap.
     *
     * @returns The complete, deduplicated list of JS/asset URLs to download.
     */
    async crawl(): Promise<string[]> {
        // Phase 1 – initial heavyweight discovery
        await this.initialDiscovery();

        // Phase 2 – recursive lightweight passes
        let currentBatch = [...this.discoveredUrls];
        let iteration = 0;

        while (iteration < this.MAX_ITERATIONS) {
            iteration++;
            const sizeBefore = this.size;

            console.log(chalk.cyan(`[i] Recursive crawl pass ${iteration} – ${sizeBefore} URLs known`));

            const newUrls = await this.recursivePass(currentBatch);

            if (newUrls.length === 0) {
                console.log(chalk.green(`[✓] Recursive crawl converged after ${iteration} pass(es)`));
                break;
            }

            console.log(chalk.green(`[+] Pass ${iteration} discovered ${newUrls.length} new URL(s)`));

            // Next pass only analyses the newly found URLs
            currentBatch = newUrls;
        }

        if (iteration >= this.MAX_ITERATIONS) {
            console.log(chalk.yellow(`[!] Reached max recursive crawl iterations (${this.MAX_ITERATIONS})`));
        }

        // Phase 3 – brute-force .map files on the final set
        const allJsUrls = [...this.discoveredUrls].filter((u) => u.endsWith(".js") || u.endsWith(".js.map"));
        const jsFromBrute = await next_bruteForceJsFiles(allJsUrls);
        this.techniqueEfficiencyMapping["next_bruteForceJsFiles"] = jsFromBrute;
        this.registerUrls(jsFromBrute);

        return [...this.discoveredUrls];
    }
}

export default NextJsCrawler;
