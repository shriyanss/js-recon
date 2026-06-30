import makeRequest from "../../utility/makeReq.js";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import chalk from "chalk";
import t from "@babel/types";

const traverse = _traverse.default;

/**
 * Scans fetched JS files for Vite's __vite__mapDeps chunk manifest and returns
 * all the discovered chunk URLs resolved against the JS file they were found in.
 *
 * Vite emits code like:
 *   const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./common.X.chunk.js",...])))=>i.map(i=>d[i]);
 * where the array literal holds relative paths to every lazy-loaded chunk.
 * The outer variable names (m, d, f) vary per build; only __vite__mapDeps is stable.
 */
const vue_viteMapDeps = async (jsFiles: string[], maxJsSizeMb: number = 2): Promise<string[]> => {
    const MAX_JS_SIZE_BYTES = maxJsSizeMb * 1024 * 1024;
    const discovered = new Set<string>();

    const jsUrls = jsFiles.filter((f) => f.endsWith(".js"));

    for (const jsUrl of jsUrls) {
        const req = await makeRequest(jsUrl);
        if (!req) continue;

        const content = await req.text();
        if (content.length > MAX_JS_SIZE_BYTES) continue;

        let ast;
        try {
            ast = parser.parse(content, {
                sourceType: "unambiguous",
                plugins: ["jsx", "typescript"],
                errorRecovery: true,
            });
        } catch {
            continue;
        }

        traverse(ast, {
            VariableDeclarator(nodePath) {
                if (!t.isIdentifier(nodePath.node.id, { name: "__vite__mapDeps" })) return;

                const init = nodePath.node.init;
                if (!init || !t.isArrowFunctionExpression(init)) return;

                // params: (i, m = __vite__mapDeps, d = (m.f || (m.f = [...])))
                // Find any AssignmentPattern param whose right side is:
                //   LogicalExpression(||) where right = AssignmentExpression whose right = ArrayExpression
                for (const param of init.params) {
                    if (!t.isAssignmentPattern(param)) continue;

                    const right = param.right;
                    if (!t.isLogicalExpression(right) || right.operator !== "||") continue;

                    const rhsOfOr = right.right;
                    if (!t.isAssignmentExpression(rhsOfOr)) continue;
                    if (!t.isArrayExpression(rhsOfOr.right)) continue;

                    const foundInThisFile: string[] = [];
                    const jsOrigin = new URL(jsUrl).origin + "/";
                    for (const element of rhsOfOr.right.elements) {
                        if (!element || !t.isStringLiteral(element)) continue;
                        const val = element.value;
                        if (!val.endsWith(".js")) continue;
                        // Explicit relative paths (./  or ../) → file-relative.
                        // Everything else (bare "assets/x.js" or absolute "/assets/x.js")
                        // → root-relative: resolve against origin so Vite paths like
                        // "assets/chunk.js" don't double-up the directory segment.
                        const isFileRelative = val.startsWith("./") || val.startsWith("../");
                        foundInThisFile.push(new URL(val, isFileRelative ? jsUrl : jsOrigin).href);
                    }

                    if (foundInThisFile.length > 0) {
                        console.log(
                            chalk.green(`[✓] Found ${foundInThisFile.length} chunks from __vite__mapDeps in ${jsUrl}`)
                        );
                        for (const u of foundInThisFile) discovered.add(u);
                    }
                }
            },
        });
    }

    return [...discovered];
};

export default vue_viteMapDeps;
