import chalk from "chalk";
import fs from "fs";
import { marked } from "marked";
import Database from "better-sqlite3";
import addAnalyze from "./markdownGen/addAnalyze.js";

const html = async (markdown: string) => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Markdown Report</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github-dark.css">
</head>
<body>
  ${await marked(markdown)}
</body>
</html>`;
};

const genHtml = async (outputReportFile: string, db: Database.Database) => {
    console.log(chalk.cyan("[i] Generating HTML report..."));

    let markdown = `# JS Recon Report generated at ${new Date().toISOString()}\n\n`;

    markdown = await addAnalyze(markdown, db);

    marked.use({
        async: true,
        pedantic: false,
        gfm: true,
    });
    const renderedHtml = await html(markdown);
    fs.writeFileSync(outputReportFile, renderedHtml);

    console.log(chalk.green("[✓] HTML report generated successfully"));
};

export default genHtml;
