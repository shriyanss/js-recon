import chalk from "chalk";
import fs from "fs";
import { marked } from "marked";
import hljs from 'highlight.js';
import Database from "better-sqlite3";
import addAnalyze from "./markdownGen/addAnalyze.js";

const html = async (markdown: string) => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Markdown Report</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github-dark.css">
  <style>
    h2, h3, h4 {
        cursor: pointer;
        position: relative;
        padding-left: 20px;
    }
    h2::before, h3::before, h4::before {
        content: '▼';
        position: absolute;
        left: 0;
        transition: transform 0.2s;
    }
    .collapsed::before {
        transform: rotate(-90deg);
    }
  </style>
</head>
<body>
  ${await marked(markdown)}
  <script>
    document.addEventListener('DOMContentLoaded', () => {
        const headers = document.querySelectorAll('h2, h3, h4');

        const getHeaderLevel = (header) => parseInt(header.tagName.substring(1));

        headers.forEach((header, index) => {
            const level = getHeaderLevel(header);

            // Set initial state for H3 headers
            if (header.tagName.toLowerCase() === 'h3') {
                header.classList.add('collapsed');
            }

            header.addEventListener('click', () => {
                header.classList.toggle('collapsed');
                updateVisibility();
            });
        });

        const updateVisibility = () => {
            let parentCollapsedLevels = [];

            headers.forEach(header => {
                const level = getHeaderLevel(header);

                // Remove deeper or same-level collapsed states
                parentCollapsedLevels = parentCollapsedLevels.filter(l => l < level);

                if (parentCollapsedLevels.length > 0) {
                    header.style.display = 'none';
                } else {
                    header.style.display = '';
                }

                if (header.classList.contains('collapsed')) {
                    parentCollapsedLevels.push(level);
                }

                let nextEl = header.nextElementSibling;
                while (nextEl && !nextEl.tagName.match(/^H[1-4]$/)) {
                    if (parentCollapsedLevels.length > 0) {
                        nextEl.style.display = 'none';
                    } else {
                        nextEl.style.display = '';
                    }
                    nextEl = nextEl.nextElementSibling;
                }
            });
        };

        updateVisibility(); // Initial run to set the correct state on load
    });
  </script>
</body>
</html>`;
};

const genHtml = async (outputReportFile: string, db: Database.Database) => {
    console.log(chalk.cyan("[i] Generating HTML report..."));

    let markdown = `# JS Recon Report generated at ${new Date().toISOString()}\n\n`;

    markdown = await addAnalyze(markdown, db);

    const renderer = new marked.Renderer();
    renderer.code = ({ text, lang }) => {
        const language = hljs.getLanguage(lang as string) ? lang as string : 'plaintext';
        const highlightedCode = hljs.highlight(text, { language, ignoreIllegals: true }).value;
        return `<pre><code class="hljs ${language}">${highlightedCode}</code></pre>`;
    };

    marked.setOptions({
        renderer,
        async: true,
        pedantic: false,
        gfm: true,
    });
    const renderedHtml = await html(markdown);
    fs.writeFileSync(outputReportFile, renderedHtml);

    console.log(chalk.green("[✓] HTML report generated successfully"));
};

export default genHtml;
