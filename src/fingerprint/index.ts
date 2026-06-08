import chalk from "chalk";
import fs from "fs";
import path from "path";
import * as cliProgress from "cli-progress";
import frameworkDetect from "../lazyLoad/techDetect/index.js";
import { computeBarSize, watchBarResize, setActiveBarLogger, progressLog } from "../utility/progressLog.js";
import * as globalsUtil from "../utility/globals.js";

type OutputFormat = "text" | "csv" | "json" | "jsonl";

interface FingerprintResult {
    url: string;
    framework: string | null;
}

const FRAMEWORK_LABELS: Record<string, string> = {
    next: "next.js",
    vue: "vue.js",
    nuxt: "nuxt.js",
    svelte: "svelte",
    angular: "angular",
    react: "react",
};

const parseUrls = (urlArg: string): string[] => {
    if (fs.existsSync(urlArg)) {
        return fs
            .readFileSync(urlArg, "utf-8")
            .split("\n")
            .map((u) => u.trim())
            .filter((u) => u.length > 0);
    }
    return [urlArg];
};

const deriveOutputPath = (outputFile: string, format: OutputFormat): string => {
    const ext = path.extname(outputFile);
    const base = ext ? outputFile.slice(0, -ext.length) : outputFile;
    if (format === "csv") return `${base}.csv`;
    if (format === "json") return `${base}.json`;
    if (format === "jsonl") return `${base}.jsonl`;
    return `${base}.txt`;
};

const writeResults = (results: FingerprintResult[], outputFile: string, formats: OutputFormat[]): void => {
    for (const format of formats) {
        const filePath = deriveOutputPath(outputFile, format);

        if (format === "csv") {
            const lines = ["framework,url"];
            for (const r of results) {
                lines.push(`${r.framework ?? "unknown"},${r.url}`);
            }
            fs.writeFileSync(filePath, lines.join("\n") + "\n");
        } else if (format === "json") {
            const data = results.map((r) => ({ url: r.url, framework: r.framework ?? "unknown" }));
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
        } else if (format === "jsonl") {
            const lines = results.map((r) => JSON.stringify({ url: r.url, framework: r.framework ?? "unknown" }));
            fs.writeFileSync(filePath, lines.join("\n") + "\n");
        } else {
            const lines = results.map((r) => `[${r.framework ?? "unknown"}] ${r.url}`);
            fs.writeFileSync(filePath, lines.join("\n") + "\n");
        }

        console.log(chalk.green(`[✓] Results written to ${filePath}`));
    }
};

const fingerprint = async (urlArg: string, outputFile: string | undefined, formatArg: string): Promise<void> => {
    const urls = parseUrls(urlArg);

    const rawFormats = formatArg
        .split(",")
        .map((f) => f.trim().toLowerCase())
        .filter((f) => f === "text" || f === "csv" || f === "json" || f === "jsonl") as OutputFormat[];
    const formats: OutputFormat[] = rawFormats.length > 0 ? rawFormats : ["text"];

    const results: FingerprintResult[] = [];

    const overhead = 52;
    const multiBar = new cliProgress.MultiBar(
        {
            format: chalk.cyan("[i] Fingerprinting ") + "[{bar}] {value}/{total} | {url}",
            barCompleteChar: "█",
            barIncompleteChar: "░",
            barsize: computeBarSize(overhead),
            hideCursor: true,
            clearOnComplete: false,
            stopOnComplete: false,
        },
        cliProgress.Presets.shades_classic
    );

    const bar = multiBar.create(urls.length, 0, { url: "" });
    const stopWatcher = watchBarResize(bar, overhead);
    setActiveBarLogger(multiBar);

    globalsUtil.setQuiet(true);

    for (const url of urls) {
        const displayUrl = url.length > 50 ? url.slice(0, 47) + "..." : url;
        bar.update({ url: displayUrl });

        let framework: string | null = null;
        try {
            const tech = await frameworkDetect(url);
            framework = tech ? tech.name : null;
        } catch {
            // detection failure — treat as unknown
        }

        results.push({ url, framework });

        const label = framework ? (FRAMEWORK_LABELS[framework] ?? framework) : "unknown";
        const line = framework ? chalk.green(`[${label}] ${url}`) : chalk.dim(`[unknown] ${url}`);
        progressLog(line);

        bar.increment(1);
    }

    globalsUtil.setQuiet(false);
    multiBar.stop();
    setActiveBarLogger(null);
    stopWatcher();

    const detected = results.filter((r) => r.framework !== null).length;
    console.log(chalk.cyan(`\n[i] ${detected}/${results.length} URLs fingerprinted`));

    if (outputFile) {
        writeResults(results, outputFile, formats);
    }
};

export default fingerprint;
