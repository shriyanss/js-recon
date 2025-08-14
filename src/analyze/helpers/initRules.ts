import chalk from "chalk";
import fs from "fs";
import path from "path";
import extract from "extract-zip";

const downloadRules = async (homeDir: string) => {
    console.log(chalk.cyan("[i] Rules not found. Downloading from GitHub..."));
    const response = await fetch("https://api.github.com/repos/shriyanss/js-recon-rules/releases/latest");
    const release = await response.json();
    const zipballUrl = release.zipball_url;

    const zipPath = path.join(homeDir, "/.js-recon/rules.zip");
    const downloadResponse = await fetch(zipballUrl);

    if (!downloadResponse.ok) {
        throw new Error(`Failed to download rules: ${downloadResponse.statusText}`);
    }

    const arrayBuffer = await downloadResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(zipPath, buffer);

    console.log(chalk.cyan("[i] Unzipping rules..."));
    const extractPath = path.join(homeDir, "/.js-recon");
    await extract(zipPath, { dir: extractPath });

    // Find the extracted directory
    const files = fs.readdirSync(extractPath);
    const extractedDir = files.find(
        (file) =>
            fs.statSync(path.join(extractPath, file)).isDirectory() && file.startsWith("shriyanss-js-recon-rules-")
    );

    if (extractedDir) {
        fs.renameSync(path.join(extractPath, extractedDir), path.join(extractPath, "rules"));
    } else {
        throw new Error("Could not find extracted rules directory.");
    }

    fs.unlinkSync(zipPath); // Clean up the zip file
    // remove the directory .js-recon/rules/.github
    fs.rmSync(path.join(homeDir, "/.js-recon/rules/.github"), { recursive: true });
    console.log(chalk.green("[✓] Rules initialized successfully."));
};

const initRules = async () => {
    console.log(chalk.cyan("[i] Initializing rules..."));

    // get the user's home dir
    const homeDir = process.env.HOME;

    // check if the .js-recon directory exists
    if (!fs.existsSync(path.join(homeDir, "/.js-recon"))) {
        fs.mkdirSync(path.join(homeDir, "/.js-recon"));
    }

    // now, check if the rules directory exists
    if (!fs.existsSync(path.join(homeDir, "/.js-recon/rules"))) {
        await downloadRules(homeDir);
    }

    // now that this rule exists, check if the version.txt exists
    const versionPath = path.join(homeDir, "/.js-recon/rules/version.txt");
    if (!fs.existsSync(versionPath)) {
        console.log(chalk.yellow("[!] Rules directory is corrupted. Downloading again..."));
        // remove the rules directory
        fs.rmSync(path.join(homeDir, "/.js-recon/rules"), { recursive: true });
        await downloadRules(homeDir);
    }

    // also, if the version.txt exist, check if the version.txt is latest as per the latest release on github
    const version = fs.readFileSync(versionPath, "utf8").trim();
    try {
        const response = await fetch("https://api.github.com/repos/shriyanss/js-recon-rules/releases/latest");
        const release = await response.json();
        const release_tag_name = release.tag_name;
        if (`v${version}` !== release_tag_name) {
            console.log(chalk.yellow("[!] Rules are not up to date. Downloading latest version..."));
            // remove the rules directory
            fs.rmSync(path.join(homeDir, "/.js-recon/rules"), { recursive: true });
            await downloadRules(homeDir);
        }
    } catch {
        console.error(chalk.red("[!] An error occured when fetching rules from GitHub"));
    }
};

export default initRules;
