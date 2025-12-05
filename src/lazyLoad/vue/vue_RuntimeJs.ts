/**
 * ==============================================
 * ==============================================
 * ==============================================
 *
 *            !!!INCOMPLETE MODULE!!!
 *
 *             WILL RETURN BLANK LIST
 *
 * ==============================================
 * ==============================================
 * ==============================================
 */

import makeRequest from "../../utility/makeReq.js";
import * as cheerio from "cheerio";
import path from "path";
import * as parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;

const vue_runtimeJs = async (url: string) => {
    let discovered_urls: string[] = [];

    const rootHtml: string = await makeRequest(url).then((res) => res.text());

    let runtimeJsUrl: string | undefined;

    // iterate through the HTML, and find all script tags.
    // from those, find the one that has runtime.<hash>.js

    // DEBUG: base64 decode the HTML
    const $ = cheerio.load(rootHtml);
    // const $ = cheerio.load(Buffer.from(rootHtml, "base64").toString("utf-8"));
    $("script").each((_, el) => {
        const tag = $(el).get(0).tagName;
        const attribs = el.attribs;
        if (attribs) {
            for (const [attrName, attrValue] of Object.entries(attribs)) {
                if (attrName === "src") {
                    // @ts-ignore
                    if (attrValue.match(/runtime\..+\.js/)) {
                        // @ts-ignore
                        runtimeJsUrl = attrValue;
                    }
                }
            }
        }
    });

    if (runtimeJsUrl) {
        // if it starts with HTTP, then great. else, construct using path.join
        if (!runtimeJsUrl.startsWith("http")) {
            runtimeJsUrl = path.join(url, runtimeJsUrl);
        } else {
            runtimeJsUrl = path.join(url, runtimeJsUrl);
        }
    }

    // now, get the contents of the runtime.<hash>.js file
    const runtimeJsContent: string = await makeRequest(runtimeJsUrl).then((res) => res.text());

    // ast parser goes brrrr
    const ast = parser.parse(runtimeJsContent, {
        sourceType: "unambiguous",
        plugins: ["jsx", "typescript"],
        errorRecovery: true,
    });

    // now, traverse the ast, and find the right spot
    // Looking for: script.src = function(e) { ... }(e)
    let scriptSrcAssignment: Node | null = null;
    traverse(ast, {
        AssignmentExpression(path) {
            const { left, right } = path.node;

            // Check if left side is `script.src`
            if (
                left.type === "MemberExpression" &&
                left.object.type === "Identifier" &&
                left.object.name === "script" &&
                left.property.type === "Identifier" &&
                left.property.name === "src"
            ) {
                // Check if right side is a CallExpression (IIFE pattern)
                // i.e., function(e) { ... }(e)
                if (right.type === "CallExpression" && right.callee.type === "FunctionExpression") {
                    // Found the pattern! Extract the function body
                    const funcExpr = right.callee;

                    // Get the source code for this node
                    const start = path.node.start;
                    const end = path.node.end;
                    if (start !== null && end !== null) {
                        const sourceCode = runtimeJsContent.slice(start, end);
                        console.log("Found script.src assignment:", sourceCode);
                        scriptSrcAssignment = path.node;
                        // TODO: Process the function body to extract chunk mappings
                        // The function typically contains object mappings for chunk names and hashes
                    }
                }
            }
        },
    });

    // TODO: Add the rest of the logic from the code

    return discovered_urls;
};

export default vue_runtimeJs;
