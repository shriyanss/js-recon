import fs from "fs";
import chalk from "chalk";

const gen_markdown = async (url, hrefs, output) => {
  const hosts = {};
  const baseUrlObj = new URL(url);

  // Ensure the base host is in the list
  hosts[baseUrlObj.hostname] = new Set();

  for (const href of hrefs) {
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }

    let fullUrl;
    try {
      // Handle protocol-relative, absolute, and relative URLs
      if (href.startsWith("//")) {
        fullUrl = new URL(`${baseUrlObj.protocol}${href}`);
      } else {
        fullUrl = new URL(href, baseUrlObj.href);
      }

      const host = fullUrl.hostname;
      if (!hosts[host]) {
        hosts[host] = new Set();
      }

      const path = fullUrl.pathname + fullUrl.search + fullUrl.hash;
      // Only add meaningful paths
      if (path !== "/" || fullUrl.href !== baseUrlObj.href) {
        hosts[host].add(path);
      }
    } catch (e) {
      console.error(`Skipping invalid URL or path: ${href}`);
    }
  }

  let mermaidDiagram = "```mermaid\ngraph TD\n";

  const hostNodeIds = {};
  Object.keys(hosts).forEach((host, index) => {
    const nodeId = `H${index}`;
    hostNodeIds[host] = nodeId;
    mermaidDiagram += `    ${nodeId}["${host}"]\n`;
  });

  Object.entries(hosts).forEach(([host, paths]) => {
    const hostNodeId = hostNodeIds[host];

    paths.forEach((path, pathIndex) => {
      const pathNodeId = `${hostNodeId}_P${pathIndex}`;
      const pathLabel = path.replace(/"/g, "#quot;");

      mermaidDiagram += `    ${pathNodeId}["${pathLabel}"]\n`;
      mermaidDiagram += `    ${hostNodeId} --> ${pathNodeId}\n`;
    });
  });

  mermaidDiagram += "```";

  fs.writeFileSync(`${output}.md`, mermaidDiagram);
  console.log(chalk.green(`[✓] Generated markdown report at ${output}.md`));
  return mermaidDiagram;
};

export default gen_markdown;
