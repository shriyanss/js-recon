import chalk from "chalk";
import fs from "fs";
import { marked } from "marked";
import hljs from "highlight.js";
import Database from "better-sqlite3";
import addAnalyze from "./markdownGen/addAnalyze.js";

declare global {
    interface Window {
        marked: any;
    }
}

const html = async (markdown: string) => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>JS Recon Report</title>
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
    body {
      padding-top: 80px; /* Height of the navbar */
    }
    .navbar {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      background-color: #ffffff;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      align-items: center;
      padding: 10px 20px;
      z-index: 1000;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .navbar-logo img {
      height: 40px;
    }
    .navbar-links {
      list-style: none;
      margin: 0 0 0 20px;
      padding: 0;
      display: flex;
      gap: 15px;
    }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-logo">
      <img src="https://js-recon.io/img/js-recon-logo.png" alt="JS Recon Logo">
    </div>
    <ul class="navbar-links" id="navbar-links">
      <li><a href="#home">Home</a></li>
      <li><a href="#hello">Hello</a></li>
      <li><a href="#test">Test</a></li>
    </ul>
  </nav>
  <div id="content"></div>
  <script id="page-data" type="application/json">
    ${JSON.stringify({ home: markdown, hello: '## Hello Page\n\nThis is the hello page content.', test: '## Test Page\n\nThis is the test page content.' })}
  </script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const contentDiv = document.getElementById('content');
      const navbarLinks = document.getElementById('navbar-links');
      const pages = JSON.parse(document.getElementById('page-data').textContent);

      const updateVisibility = () => {
        const headers = contentDiv.querySelectorAll('h2, h3, h4');
        let parentCollapsedLevels = [];
        headers.forEach(header => {
          const level = parseInt(header.tagName.substring(1));
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

      const initializeCollapsibleHeaders = () => {
        const headers = contentDiv.querySelectorAll('h2, h3, h4');
        headers.forEach((header) => {
          if (header.tagName.toLowerCase() === 'h3') {
            header.classList.add('collapsed');
          }
          header.addEventListener('click', () => {
            header.classList.toggle('collapsed');
            updateVisibility();
          });
        });
        updateVisibility();
      };

      const renderPage = (pageName) => {
        const markdownContent = pages[pageName] || '<h2>Page Not Found: ' + pageName + '</h2>';
        contentDiv.innerHTML = window.marked.parse(markdownContent);
        initializeCollapsibleHeaders();
      };

      const handleHashChange = () => {
        const pageName = window.location.hash.substring(1) || 'home';
        renderPage(pageName);
      };

      navbarLinks.addEventListener('click', (event) => {
        if (event.target.tagName === 'A') {
          event.preventDefault();
          const pageName = event.target.hash.substring(1);
          window.location.hash = pageName;
        }
      });

      window.addEventListener('hashchange', handleHashChange);

      // Initial page load
      handleHashChange();
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
        const language = hljs.getLanguage(lang as string) ? (lang as string) : "plaintext";
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
