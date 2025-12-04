import makeRequest from "../../utility/makeReq.js";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import chalk from "chalk";

const traverse = _traverse.default;

const parseJsFile = async (url: string) => {
    let foundUrls: string[] = [];
    const req = await makeRequest(url);
    const reqText = await req.text();

    const ast = parser.parse(reqText, {
        sourceType: "module",
        plugins: ["importAssertions"],
    });

    // get all the import statements
    traverse(ast, {
        ImportDeclaration(path) {
            const source = path.node.source.value;

            if (source.startsWith("./")) {
                if (!foundUrls.includes(new URL(source, url).href)) {
                    foundUrls.push(new URL(source, url).href);
                }
            } else {
                // DEBUG
                console.log(chalk.red(`Found import statement but can't resolve it: ${source} - on ${url}`));
            }
        },
    });

    return foundUrls;
};

const vue_jsImports = async (url: string, foundJsFiles: string[]) => {
    let foundUrls: string[] = [];
    let crawledUrls: string[] = [];

    // iterate through URLs, and get the contents of those
    for (const jsfile of foundJsFiles) {
        const foundUrlsParsed = await parseJsFile(jsfile);
        foundUrls.push(...foundUrlsParsed);
        if (!crawledUrls.includes(jsfile)) {
            crawledUrls.push(jsfile);
        }
    }

    // continue crawling until no new URLs are found
    while (foundUrls.length === crawledUrls.length) {
        // iterate through foundUrls
        for (const url of foundUrls) {
            if (!crawledUrls.includes(url)) {
                crawledUrls.push(url);
                const foundUrlsParsed = await parseJsFile(url);
                foundUrls.push(...foundUrlsParsed);
            }
        }
    }

    return foundUrls;
};

export default vue_jsImports;
