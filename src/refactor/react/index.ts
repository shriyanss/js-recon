import chalk from "chalk";
import parser from "@babel/parser";
import _traverse, { NodePath } from "@babel/traverse";
import _generator from "@babel/generator";
import * as t from "@babel/types";
import { Chunk } from "../../utility/interfaces.js";
const traverse = _traverse.default;
const generate = _generator.default;

/**
 * Refactors a webpack-bundled React chunk into a more readable, ES-module-ish form.
 *
 * A single chunk file usually contains many webpack module functions of the shape
 * `function (module, exports, require) { ... }` keyed by numeric id inside a single
 * `webpackChunk_*.push([[id], { ... }])` call. This pass walks every such inner
 * function on its own and, scoped to that function's positional param names:
 *   1. Rewrites `<require>(<n>)` to `require("./<n>.js")` so cross-chunk references
 *      resolve when the output is viewed in an editor.
 *   2. Captures webpack exports written via either
 *        `Object.defineProperty(<exports>, "key", { get: () => local })`
 *      or the runtime helper
 *        `<require>.d(<exports>, { key: () => local, ... })`
 *      and replaces those call sites with `void 0`, appending an
 *      `export { local as key, ... }` (or `export default local` for "default")
 *      at the end of the file.
 *   3. Falls back to `export default <topLevelFn>` when no explicit exports were found,
 *      matching the original Next.js behaviour.
 *
 * Lossy — minifier locals collide across modules in the same chunk, so the trailing
 * `export { ... }` line is best-effort and only meaningful to a human reader.
 * Output is for human inspection only; do not feed it back into `map`.
 */
const refactorReact = async (chunk: Chunk): Promise<string> => {
    console.log(chalk.cyan(`[i] Refactoring React chunk: ${chunk.id}`));

    const ast = parser.parse(chunk.code, {
        sourceType: "unambiguous",
        plugins: ["jsx", "typescript"],
        errorRecovery: true,
    });

    const collectedExports: Array<{ key: string; local: string }> = [];

    const processModuleFunction = (
        fnPath: NodePath<t.Function>,
        params: ReadonlyArray<t.Node>
    ): void => {
        if (params.length < 3) return;
        const exportsParam = params[1];
        const requireParam = params[2];
        if (!t.isIdentifier(exportsParam) || !t.isIdentifier(requireParam)) return;
        const exportsName = exportsParam.name;
        const requireName = requireParam.name;

        fnPath.traverse({
            CallExpression(innerPath) {
                const node = innerPath.node;

                if (
                    t.isIdentifier(node.callee, { name: requireName }) &&
                    node.arguments.length === 1 &&
                    t.isNumericLiteral(node.arguments[0])
                ) {
                    innerPath.replaceWith(
                        t.callExpression(t.identifier("require"), [
                            t.stringLiteral(`./${(node.arguments[0] as t.NumericLiteral).value}.js`),
                        ])
                    );
                    return;
                }

                if (
                    t.isMemberExpression(node.callee) &&
                    t.isIdentifier(node.callee.object, { name: requireName }) &&
                    t.isIdentifier(node.callee.property, { name: "d" }) &&
                    node.arguments.length === 2 &&
                    t.isIdentifier(node.arguments[0], { name: exportsName }) &&
                    t.isObjectExpression(node.arguments[1])
                ) {
                    for (const prop of node.arguments[1].properties) {
                        if (!t.isObjectProperty(prop)) continue;
                        const key = getStaticKey(prop.key);
                        if (!key) continue;
                        const local = extractGetterLocal(prop.value);
                        if (!local) continue;
                        collectedExports.push({ key, local });
                    }
                    innerPath.replaceWith(t.identifier("void 0"));
                    return;
                }

                if (
                    t.isMemberExpression(node.callee) &&
                    t.isIdentifier(node.callee.object, { name: "Object" }) &&
                    t.isIdentifier(node.callee.property, { name: "defineProperty" }) &&
                    node.arguments.length === 3 &&
                    t.isIdentifier(node.arguments[0], { name: exportsName }) &&
                    t.isStringLiteral(node.arguments[1]) &&
                    t.isObjectExpression(node.arguments[2])
                ) {
                    const key = node.arguments[1].value;
                    for (const prop of node.arguments[2].properties) {
                        if (!t.isObjectProperty(prop)) continue;
                        if (getStaticKey(prop.key) !== "get") continue;
                        const local = extractGetterLocal(prop.value);
                        if (!local) continue;
                        collectedExports.push({ key, local });
                    }
                    innerPath.replaceWith(t.identifier("void 0"));
                    return;
                }
            },
        });
    };

    traverse(ast, {
        FunctionDeclaration(path) {
            processModuleFunction(path, path.node.params);
        },
        FunctionExpression(path) {
            processModuleFunction(path, path.node.params);
        },
        ArrowFunctionExpression(path) {
            processModuleFunction(path, path.node.params);
        },
        ObjectMethod(path) {
            // Path<ObjectMethod> is a Function-shaped node for traverse purposes.
            processModuleFunction(path as unknown as NodePath<t.Function>, path.node.params);
        },
    });

    let codeCopy = generate(ast).code;

    if (collectedExports.length === 0) {
        let functionName: string | null = null;
        traverse(ast, {
            FunctionDeclaration(path) {
                if (path.parent.type === "Program" && path.node.id) {
                    functionName = path.node.id.name;
                    path.stop();
                }
            },
            VariableDeclarator(path) {
                if (
                    path.parentPath.parent.type === "Program" &&
                    path.node.init &&
                    path.node.init.type === "ArrowFunctionExpression" &&
                    path.node.id.type === "Identifier"
                ) {
                    functionName = path.node.id.name;
                    path.stop();
                }
            },
        });
        if (functionName) {
            codeCopy += `\n\nexport default ${functionName};`;
        }
    } else {
        // Multiple webpack modules can be flattened into one chunk and each can
        // export "default" — keep only the first occurrence of every key so the
        // emitted ES module is still parseable. Subsequent collisions get a
        // suffixed alias so a reader can still see the local they map to.
        const usedKeys = new Set<string>();
        const usedLocals = new Set<string>();
        const lines: string[] = [];
        const named: Array<{ key: string; local: string }> = [];
        let collisionIndex = 0;
        for (const entry of collectedExports) {
            if (usedLocals.has(entry.local)) continue;
            usedLocals.add(entry.local);
            let key = entry.key;
            if (usedKeys.has(key)) {
                collisionIndex += 1;
                key = `${entry.key}_${collisionIndex}`;
            }
            usedKeys.add(key);
            if (key === "default") {
                lines.push(`export default ${entry.local};`);
            } else {
                named.push({ key, local: entry.local });
            }
        }
        if (named.length > 0) {
            const namedList = named
                .map(({ key, local }) => (key === local ? key : `${local} as ${key}`))
                .join(", ");
            lines.push(`/* webpack-derived exports — keys may collide across modules in the chunk */`);
            lines.push(`export { ${namedList} };`);
        }
        codeCopy += `\n\n${lines.join("\n")}`;
    }

    return codeCopy;
};

const getStaticKey = (node: t.Node): string | null => {
    if (t.isIdentifier(node)) return node.name;
    if (t.isStringLiteral(node)) return node.value;
    return null;
};

const extractGetterLocal = (node: t.Node): string | null => {
    if (t.isArrowFunctionExpression(node)) {
        if (t.isIdentifier(node.body)) return node.body.name;
        if (t.isBlockStatement(node.body)) {
            for (const stmt of node.body.body) {
                if (t.isReturnStatement(stmt) && stmt.argument && t.isIdentifier(stmt.argument)) {
                    return stmt.argument.name;
                }
            }
        }
    }
    if (t.isFunctionExpression(node) && t.isBlockStatement(node.body)) {
        for (const stmt of node.body.body) {
            if (t.isReturnStatement(stmt) && stmt.argument && t.isIdentifier(stmt.argument)) {
                return stmt.argument.name;
            }
        }
    }
    return null;
};

export default refactorReact;
