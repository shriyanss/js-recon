import chalk from "chalk";
import fs from "fs";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;
import parser from "@babel/parser";
import { Chunks } from "../../utility/interfaces.js";

const isFetchIdentifier = (node) => {
    return node.type === "Identifier" && node.name === "fetch";
};

const isFetchFallback = (node) => {
    // x ?? fetch      OR     cond ? x : fetch
    return (
        (node.type === "LogicalExpression" &&
            node.right &&
            isFetchIdentifier(node.right)) ||
        (node.type === "ConditionalExpression" &&
            isFetchIdentifier(node.alternate))
    );
};

const getFetchInstances = async (chunks: Chunks, output, formats) => {
    console.log(chalk.cyan("[i] Running 'getFetchInstances' module"));
    let chunk_copy: Chunks = { ...chunks };

    //   iterate through the chunks, and check fetch instances
    for (let chunk of Object.values(chunks)) {
        const chunkAst = parser.parse(chunk.code, {
            sourceType: "module",
            plugins: ["jsx", "typescript"],
        });
        const fetchAliases = new Set();
        const fetchCalls = new Set();
        traverse(chunkAst, {
            // -------- Pass 1:  look for aliases --------
            //  a)  const S = fetch;
            //  b)  const S = something ?? fetch;
            //  c)  const S = cond ? x : fetch;
            VariableDeclarator(path) {
                const { id, init } = path.node;
                if (id.type !== "Identifier" || !init) return;

                const aliasName = id.name;
                if (isFetchIdentifier(init) || isFetchFallback(init)) {
                    // Record the binding *object* so we can track its references later
                    const binding = path.scope.getBinding(aliasName);
                    if (binding) {
                        fetchAliases.add(binding);
                    }
                }
            },
            AssignmentExpression(path) {
                // Handles re-assignment:   S = fetch;
                const { left, right } = path.node;
                if (left.type !== "Identifier") return;

                if (isFetchIdentifier(right) || isFetchFallback(right)) {
                    const binding = path.scope.getBinding(left.name);
                    if (binding) {
                        fetchAliases.add(binding);
                    }
                }
            },
            CallExpression(path) {
                if (isFetchIdentifier(path.node.callee)) {
                    const { line, column } = path.node.callee.loc.start;
                    fetchCalls.add({
                        line,
                        column,
                    });
                }
            },
        });

        // -------- Pass 2:  report the call-sites (aliases) --------
        for (const binding of fetchAliases) {
            // @ts-ignore
            binding.referencePaths.forEach((ref) => {
                const parent = ref.parent;
                if (
                    parent.type === "CallExpression" &&
                    parent.callee === ref.node
                ) {
                    const { line, column } = ref.node.loc.start;
                    console.log(
                        chalk.magenta(
                            `[fetch] Webpack ID ${chunk.id}: fetch() alias '${ref.node.name}' called at ${line}:${column}`
                        )
                    );
                }
            });
        }

        // -------- Pass 3:  report the call-sites (direct) --------
        for (const call of fetchCalls) {
            console.log(
                chalk.magenta(
                    // @ts-ignore
                    `[fetch] Webpack ID ${chunk.id}: fetch() called at ${call.line}:${call.column}`
                )
            );
        }

        // if the length of either of the sets is non-zero, then mark the chunk as containing fetch
        if (fetchAliases.size > 0 || fetchCalls.size > 0) {
            chunk_copy[chunk.id].containsFetch = true;
        }
    }

    if (formats.includes("json")) {
        const chunks_json = JSON.stringify(chunks, null, 2);
        fs.writeFileSync(`${output}.json`, chunks_json);
        console.log(
            chalk.green(
                `[✓] Saved webpack with fetch instances to ${output}.json`
            )
        );
    }

    return chunk_copy;
};

export default getFetchInstances;
