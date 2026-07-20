import makeRequest from "../../utility/makeReq.js";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import chalk from "chalk";

/**
 * Extracts JS chunk URLs from <script src> and <link rel="modulepreload"> tags,
 * and saves inline <script> bodies to disk. Mirrors react_getScriptTags.ts — the
 * same seeding pattern applies to any site regardless of framework.
 */
const generic_getScriptTags = async (
    url: string,
    maxJsSizeMb: number,
    outputDir?: string
): Promise<{ urls: string[]; pageSource: string }> => {
    let toReturn: string[] = [];

    const req = await makeRequest(url);
    const pageSource = req ? await req.text() : "";

    const $ = cheerio.load(pageSource);
    const host = new URL(url).host.replace(":", "_");
    let inlineIndex = 0;

    $("script").each((_, elem) => {
        const src = $(elem).attr("src");
        if (src) {
            try {
                toReturn.push(new URL(src, url).href);
            } catch {
                /* not a resolvable URL — skip */
            }
        } else if (outputDir) {
            const content = $(elem).text().trim();
            if (!content) return;

            const hostDir = path.join(outputDir, host);
            fs.mkdirSync(hostDir, { recursive: true });
            const filename = `inline-${inlineIndex++}.js`;
            const filePath = path.join(hostDir, filename);
            fs.writeFileSync(filePath, `// File Source: ${url} (inline script #${inlineIndex - 1})\n${content}`);
            console.log(chalk.green(`[✓] Saved inline script to ${filePath}`));
        }
    });

    $("link[rel='modulepreload']").each((_, elem) => {
        const href = $(elem).attr("href");
        if (href) {
            try {
                toReturn.push(new URL(href, url).href);
            } catch {
                /* not a resolvable URL — skip */
            }
        }
    });

    toReturn = [...new Set(toReturn)];
    return { urls: toReturn, pageSource };
};

export default generic_getScriptTags;
