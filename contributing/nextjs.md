# Contributing New Next.js Discovery Methods

This guide explains how to add new JavaScript file discovery techniques for Next.js applications to `js-recon`.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Discovery Method Types](#discovery-method-types)
- [Adding a New Discovery Method](#adding-a-new-discovery-method)
- [Integration into NextJsCrawler](#integration-into-nextjscrawler)
- [Best Practices](#best-practices)
- [Testing Your Method](#testing-your-method)
- [Research Mode](#research-mode)

---

## Architecture Overview

The Next.js discovery system is built around the **`NextJsCrawler`** class (`src/lazyLoad/next_js/NextJsCrawler.ts`), which implements a **three-phase crawling strategy**:

### Phase 1: Initial Discovery
Heavyweight methods that run **once** to bootstrap the crawl:
- Script tag parsing (`next_getJSScript`)
- Webpack runtime analysis (`next_GetLazyResourcesWebpackJs`) – uses Puppeteer
- `_buildManifest.js` parsing (`next_getLazyResourcesBuildManifestJs`)
- Subsequent requests with RSC headers (`subsequentRequests`)

### Phase 2: Recursive Discovery
Lightweight methods that run **multiple times** on newly discovered URLs until convergence:
- Promise.all pattern detection (`next_promiseResolve`)
- Layout.js href extraction (`next_parseLayoutJs`)
- Script tag re-parsing on new pages (`next_getJSScript`)

### Phase 3: Finalization
Post-processing on the final URL set:
- Source map brute-forcing (`next_bruteForceJsFiles`)

---

## Discovery Method Types

### Initial Discovery Methods

**When to use:**
- The method is **expensive** (e.g., launches a browser, makes many requests)
- The method doesn't benefit from being run multiple times
- The method provides a bootstrap set of URLs

**Characteristics:**
- Runs exactly **once** per crawl
- Added to `initialDiscovery()` in `NextJsCrawler.ts`
- Examples: Puppeteer-based webpack analysis, manifest parsing

### Recursive Discovery Methods

**When to use:**
- The method analyzes **JavaScript file contents** to find more JS files
- The method discovers **client-side paths** that need to be visited
- The method can find new URLs by examining URLs found in previous passes

**Characteristics:**
- Runs in a **loop** until no new URLs are discovered (max 10 iterations)
- Takes an array of URLs as input and returns newly discovered URLs
- Added to `recursivePass()` in `NextJsCrawler.ts`
- Examples: Promise.all pattern detection, layout href parsing

---

## Adding a New Discovery Method

### Step 1: Create the Method Module

Create a new file in `src/lazyLoad/next_js/` following the naming convention `next_<methodName>.ts`.

#### Example: Detecting dynamic imports

```typescript
// src/lazyLoad/next_js/next_dynamicImports.ts
import chalk from "chalk";
import makeRequest from "../../utility/makeReq.js";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;

/**
 * Finds JS files referenced in dynamic import() statements.
 * 
 * @param urls - Array of JS file URLs to analyze
 * @returns Array of newly discovered JS file URLs
 */
const next_dynamicImports = async (urls: string[]): Promise<string[]> => {
    console.log(chalk.cyan("[i] Analyzing dynamic import() statements"));
    
    const discoveredUrls: string[] = [];

    for (const url of urls) {
        try {
            const response = await makeRequest(url);
            if (!response?.ok) continue;

            const jsContent = await response.text();
            const ast = parser.parse(jsContent, {
                sourceType: "unambiguous",
                plugins: ["jsx", "typescript"],
                errorRecovery: true,
            });

            traverse(ast, {
                Import(path) {
                    // Detect: import('path/to/file.js')
                    const parent = path.parent;
                    if (
                        parent.type === "CallExpression" &&
                        parent.arguments.length > 0 &&
                        parent.arguments[0].type === "StringLiteral"
                    ) {
                        const importPath = parent.arguments[0].value;
                        if (importPath.endsWith(".js")) {
                            // Resolve relative to current URL
                            const resolvedUrl = new URL(importPath, url).href;
                            discoveredUrls.push(resolvedUrl);
                        }
                    }
                },
            });
        } catch (error) {
            // Skip files that can't be parsed
            continue;
        }
    }

    const uniqueUrls = [...new Set(discoveredUrls)];
    
    if (uniqueUrls.length > 0) {
        console.log(chalk.green(`[✓] Found ${uniqueUrls.length} JS files from dynamic imports`));
    }

    return uniqueUrls;
};

export default next_dynamicImports;
```

### Step 2: Method Signature Guidelines

**For initial discovery methods:**
```typescript
async function next_methodName(url: string): Promise<string[]>
```
- Takes the base URL as input
- Returns array of discovered URLs

**For recursive discovery methods:**
```typescript
async function next_methodName(baseUrl: string, urls: string[]): Promise<string[]>
```
- Takes base URL and array of URLs to analyze
- Returns array of **newly** discovered URLs
- Should handle empty input gracefully

### Step 3: Common Patterns

#### Pattern 1: AST-based Analysis
Use Babel parser to analyze JavaScript syntax:

```typescript
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;

const ast = parser.parse(jsContent, {
    sourceType: "unambiguous",
    plugins: ["jsx", "typescript"],
    errorRecovery: true,
});

traverse(ast, {
    // Visitor pattern
    CallExpression(path) {
        // Analyze specific AST nodes
    },
});
```

#### Pattern 2: String/Regex Matching
Quick pattern detection without parsing:

```typescript
const matches = jsContent.matchAll(/static\/chunks\/[a-zA-Z0-9_\-]+\.js/g);
for (const match of matches) {
    discoveredUrls.push(resolveUrl(match[0]));
}
```

#### Pattern 3: Request-Based Discovery
Make HTTP requests to known patterns:

```typescript
const candidateUrl = `${baseUrl}/_next/static/${hash}/chunk.js`;
const response = await makeRequest(candidateUrl);
if (response.status === 200) {
    discoveredUrls.push(candidateUrl);
}
```

---

## Integration into NextJsCrawler

### For Initial Discovery Methods

Add to `initialDiscovery()` in `NextJsCrawler.ts`:

```typescript
private async initialDiscovery(): Promise<void> {
    // ... existing methods ...

    // 5. Your new method
    const jsFromDynamicImports = await next_dynamicImports(this.url);
    this.techniqueEfficiencyMapping["next_dynamicImports"] = jsFromDynamicImports;
    this.registerUrls(jsFromDynamicImports);
    
    // ... rest of the method ...
}
```

**Don't forget to add the import at the top:**
```typescript
import next_dynamicImports from "./next_dynamicImports.js";
```

### For Recursive Discovery Methods

Add to `recursivePass()` in `NextJsCrawler.ts`:

```typescript
private async recursivePass(jsUrls: string[]): Promise<string[]> {
    let newInThisPass: string[] = [];

    // ... existing methods ...

    // Your new recursive method
    const jsFromDynamicImports = await next_dynamicImports(this.url, jsUrls);
    this.techniqueEfficiencyMapping["next_dynamicImports"] = [
        ...(this.techniqueEfficiencyMapping["next_dynamicImports"] || []),
        ...jsFromDynamicImports,
    ];
    newInThisPass.push(...this.registerUrls(jsFromDynamicImports));

    return newInThisPass;
}
```

**Key points:**
- Append to `techniqueEfficiencyMapping` (not replace) for recursive methods
- Use `registerUrls()` to deduplicate and track new URLs
- Only add truly new URLs to `newInThisPass`

---

## Best Practices

### 1. Error Handling
Always handle errors gracefully – don't crash the entire crawl:

```typescript
try {
    const response = await makeRequest(url);
    if (!response?.ok) return [];
    // ... process response ...
} catch (error) {
    // Log if needed, but continue
    return [];
}
```

### 2. URL Resolution
Use `URL` constructor for proper relative URL resolution:

```typescript
const absoluteUrl = new URL(relativePath, baseUrl).href;
```

### 3. Deduplication
Always deduplicate before returning:

```typescript
return [...new Set(discoveredUrls)];
```

### 4. Performance
- Cache expensive operations (e.g., don't re-fetch the same URL)
- Use `lazyLoadGlobals.presentInCrawledUrls()` to check if already visited
- Mark URLs as crawled with `lazyLoadGlobals.addCrawledUrl()`

```typescript
import { presentInCrawledUrls, addCrawledUrl } from "../globals.js";

for (const url of urls) {
    if (presentInCrawledUrls(url)) continue;
    
    // ... analyze URL ...
    
    addCrawledUrl(url);
}
```

### 5. Logging
Use `chalk` for consistent logging:

```typescript
import chalk from "chalk";

console.log(chalk.cyan("[i] Starting analysis..."));      // Info
console.log(chalk.green("[✓] Found 10 files"));           // Success
console.log(chalk.yellow("[!] Warning message"));          // Warning
console.log(chalk.red("[!] Error occurred"));              // Error
```

---

### 1. Integration Test with Real Sites

Test against known Next.js sites:

```bash
npm run cleanup && npm run start -- run -u https://nextjs.org -y --research
```

Check `research.json` to see how many URLs your method discovered:

```json
{
    "next_dynamicImports": [
        "https://nextjs.org/_next/static/chunks/123.js",
        "https://nextjs.org/_next/static/chunks/456.js"
    ]
}
```

### 2. Verify Convergence

Ensure your recursive method doesn't cause infinite loops:
- Check that "Recursive crawl converged" message appears
- If it hits max iterations (10), investigate why

### 3. Performance Validation

Monitor execution time:
```bash
time npm run start -- run -u https://example.com -y
```

---

## Research Mode

Use research mode to validate and compare discovery methods:

```bash
npm run start -- run -u https://example.com -y --research
```

This generates `research.json` with per-method efficiency:

```json
{
    "next_getJSScript": [
        "https://example.com/_next/static/chunks/main.js",
        "https://example.com/_next/static/chunks/webpack.js"
    ],
    "next_dynamicImports": [
        "https://example.com/_next/static/chunks/lazy-component.js"
    ],
    "next_promiseResolve": [
        "https://example.com/_next/static/chunks/pages/about.js"
    ]
}
```

**Analysis tips:**
- **Unique discoveries**: Methods that find URLs no other method finds
- **Overlap**: Methods that discover the same URLs (candidates for removal)
- **Efficiency**: URLs found per method execution
