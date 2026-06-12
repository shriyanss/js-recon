import { cs_mast_init, ParseError, buildSignatureFromConfig } from "@shriyanss/cs-mast";
import type { CsMastConfig, ScatCategory } from "@shriyanss/cs-mast";
import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";

const CS_MAST_CONFIG: CsMastConfig = {
    hash: "sha256",
    lang: "js",
    prsr: "@babel/parser",
    scat: ["lit", "decl", "loop", "cond"] as ScatCategory[],
    sinc: [],
    sourceType: "unambiguous",
};

function findJsFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findJsFiles(full));
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
            results.push(full);
        }
    }
    return results;
}

interface CollisionEntry {
    signature: string;
    count: number;
    files: string[];
}

export default async (
    outputDir: string,
    collisionTable: boolean,
    minCollisions: number,
    collisionOutput: string | undefined,
    collisionFormat: string
): Promise<void> => {
    if (collisionOutput && !["json", "csv"].includes(collisionFormat)) {
        console.log(chalk.red(`[!] Invalid format: "${collisionFormat}". Use "json" or "csv".`));
        process.exit(1);
    }

    // Resolve output path: if it's an existing directory or has no extension,
    // write collisions.<fmt> in the current working directory.
    if (collisionOutput) {
        if (
            (fs.existsSync(collisionOutput) && fs.statSync(collisionOutput).isDirectory()) ||
            !path.extname(collisionOutput)
        ) {
            collisionOutput = `collisions.${collisionFormat}`;
        }
    }

    if (!fs.existsSync(outputDir)) {
        console.log(chalk.red(`[!] Output directory not found: ${outputDir}`));
        process.exit(1);
    }

    console.log(chalk.cyan(`[*] Scanning JS files in: ${outputDir}`));
    const jsFiles = findJsFiles(outputDir);
    console.log(chalk.cyan(`[*] Found ${jsFiles.length} JS file(s)`));

    const sigMap = new Map<string, string[]>();
    let parsed = 0;
    let skipped = 0;

    for (const file of jsFiles) {
        try {
            const source = fs.readFileSync(file, "utf-8");
            const tree = cs_mast_init(source, CS_MAST_CONFIG);
            // rootSignature is empty when the File node isn't actively hashed;
            // build the full PHC string from rootHash + config instead.
            const sig = buildSignatureFromConfig(CS_MAST_CONFIG, tree.rootHash);
            if (!sigMap.has(sig)) sigMap.set(sig, []);
            sigMap.get(sig)!.push(file);
            parsed++;
        } catch (e) {
            if (e instanceof ParseError) {
                console.log(chalk.yellow(`[!] Skipping (parse error): ${file}`));
            }
            skipped++;
        }
    }

    console.log(chalk.green(`[+] Processed ${parsed} file(s), skipped ${skipped}, unique hashes: ${sigMap.size}`));

    if (!collisionTable && !collisionOutput) return;

    const collisions: CollisionEntry[] = [...sigMap.entries()]
        .filter(([, files]) => files.length >= minCollisions)
        .sort(([, a], [, b]) => b.length - a.length)
        .map(([signature, files]) => ({ signature, count: files.length, files }));

    if (collisions.length === 0) {
        console.log(chalk.yellow(`[!] No collisions found with --min-collisions ${minCollisions}`));
        return;
    }

    if (collisionTable) {
        console.log(chalk.green(`\n[+] ${collisions.length} collision group(s) found (min-collisions: ${minCollisions}):\n`));

        const sigColWidth = 60;
        const countColWidth = 7;
        const header = "Signature".padEnd(sigColWidth) + "Count".padEnd(countColWidth) + "Files";
        const separator = "─".repeat(sigColWidth) + "─".repeat(countColWidth) + "─".repeat(40);

        console.log(chalk.bold(header));
        console.log(separator);

        for (const entry of collisions) {
            // Truncate at the hash boundary: show params + first 12 hex chars
            const truncated = entry.signature.length > sigColWidth - 1
                ? entry.signature.slice(0, sigColWidth - 4) + "..."
                : entry.signature;
            const fileList = entry.files.join(", ");
            console.log(truncated.padEnd(sigColWidth) + String(entry.count).padEnd(countColWidth) + fileList);
        }
    }

    if (!collisionOutput) return;

    if (collisionFormat === "json") {
        fs.writeFileSync(collisionOutput, JSON.stringify(collisions, null, 2));
    } else {
        const rows = ["signature,count,files"];
        for (const entry of collisions) {
            rows.push(`"${entry.signature}",${entry.count},"${entry.files.join("|")}"`);
        }
        fs.writeFileSync(collisionOutput, rows.join("\n"));
    }

    console.log(chalk.green(`[+] Collision data written to: ${collisionOutput}`));
};
