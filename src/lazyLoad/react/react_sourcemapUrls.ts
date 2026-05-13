import makeRequest from "../../utility/makeReq.js";
import chalk from "chalk";

const react_sourcemapUrls = async (jsFiles: string[]): Promise<string[]> => {
    const mapUrls: string[] = [];

    for (const jsUrl of jsFiles) {
        try {
            const res = await makeRequest(jsUrl, {});
            if (!res) continue;
            const body = await res.text();
            const match = body.match(/\/\/# sourceMappingURL=(.+)$/m);
            if (match) {
                const rawRef = match[1].trim();
                const mapUrl: string = new URL(rawRef, jsUrl).href;
                // if (rawRef.startsWith("http://") || rawRef.startsWith("https://")) {
                //     mapUrl = rawRef;
                // } else {
                //     const base = jsUrl.substring(0, jsUrl.lastIndexOf("/") + 1);
                //     mapUrl = base + rawRef;
                // }
                // console.log(chalk.green(`[✓] Found sourcemap: ${mapUrl}`));
                mapUrls.push(mapUrl);
            }
        } catch (_) {
            // skip files that fail to fetch
        }
    }

    if (mapUrls.length > 0) {
        console.log(chalk.green(`[✓] Found ${mapUrls.length} sourcemaps from ${jsFiles.length} JS files`));
    }

    return mapUrls;
};

export default react_sourcemapUrls;
