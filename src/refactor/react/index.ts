import chalk from "chalk";
import parser from "@babel/parser";
import _traverse, { NodePath } from "@babel/traverse";
import _generator from "@babel/generator";
import * as t from "@babel/types";
import { Chunk } from "../../utility/interfaces.js";
const traverse = _traverse.default;
const generate = _generator.default;

/**
 * Refactors a webpack-bundled React chunk into a more readable form.
 *
 * Recognises the standard webpack 5 / React 18 production bundle shape:
 *   - An outer IIFE that holds a `{ <id>: function(module, exports, require) { ... } }`
 *     module map.
 *   - Each inner module function uses positional params named `(module, exports, require)`
 *     (minifier locals — names vary per chunk).
 *   - React's public surface lives in modules identifiable by content fingerprint
 *     (the public hooks delegate to `R.current.<hook>(...)`).
 *
 * Two layers of rewrites happen:
 *
 *   1. Webpack-level:
 *      - `<require>(<n>)`                              → `require("./<n>.js")`
 *      - `<require>.d(<exports>, { k: () => local })`  → captured into export map
 *      - `Object.defineProperty(<exports>, "k", { ... })` → captured into export map
 *
 *   2. React-level:
 *      - Catalog every inner module by content fingerprint to learn which are
 *        `react`, `react/jsx-runtime`, `react-dom/client`.
 *      - In each module body, find `var <local> = <require>(<n>)` to learn which
 *        local aliases which React module within that scope.
 *      - Rewrite `(0, <reactLocal>.<hook>)(args)` → `<hook>(args)` and collect
 *        `<hook>` into the file-level react import set. Similarly for jsx-runtime
 *        and react-dom/client.
 *      - Any remaining `(0, X.Y)(args)` flattens to `X.Y(args)` (always safe).
 *
 * Lossy — for human inspection only.
 */

const REACT_HOOK_NAMES = new Set([
    "useState",
    "useEffect",
    "useRef",
    "useContext",
    "useReducer",
    "useMemo",
    "useCallback",
    "useId",
    "useTransition",
    "useLayoutEffect",
    "useDeferredValue",
    "useImperativeHandle",
    "useDebugValue",
    "useSyncExternalStore",
    "useInsertionEffect",
    "useOptimistic",
    "useActionState",
    "useFormStatus",
]);

const REACT_TOP_LEVEL_API_NAMES = new Set([
    "createContext",
    "createElement",
    "createRef",
    "forwardRef",
    "memo",
    "lazy",
    "startTransition",
    "Fragment",
    "Children",
    "cloneElement",
    "isValidElement",
    "use",
    "act",
]);

const JSX_RUNTIME_NAMES = new Set(["jsx", "jsxs", "jsxDEV", "Fragment"]);

const REACT_DOM_CLIENT_NAMES = new Set(["createRoot", "hydrateRoot"]);

type ModuleKind = "react" | "react/jsx-runtime" | "react-dom/client";

interface ModuleCatalogEntry {
    kind: ModuleKind;
    /** export-map from the module's own require.d / defineProperty walks: canonical name → minified local */
    exportMap: Map<string, string>;
}

const refactorReact = async (chunk: Chunk): Promise<string> => {
    console.log(chalk.cyan(`[i] Refactoring React chunk: ${chunk.id}`));

    const ast = parser.parse(chunk.code, {
        sourceType: "unambiguous",
        plugins: ["jsx", "typescript"],
        errorRecovery: true,
    });

    type Module = {
        id: string;
        fnPath: NodePath<t.Function>;
        moduleParam: string;
        exportsParam: string;
        /** undefined when the module is 2-param (no require) */
        requireParam: string | undefined;
    };
    const modules: Module[] = [];

    const captureModule = (id: string, fnPath: NodePath<t.Function>, params: ReadonlyArray<t.Node>): void => {
        if (params.length < 2) return;
        const m = params[0],
            e = params[1],
            r = params.length >= 3 ? params[2] : undefined;
        if (!t.isIdentifier(m) || !t.isIdentifier(e)) return;
        if (r !== undefined && !t.isIdentifier(r)) return;
        modules.push({
            id,
            fnPath,
            moduleParam: m.name,
            exportsParam: e.name,
            requireParam: r ? (r as t.Identifier).name : undefined,
        });
    };

    // Only capture entries whose key is numeric AND whose grandparent is an
    // ObjectExpression at module level (the webpack module map). This filters
    // out the many `useImperativeHandle(e, n, t) { ... }` ObjectMethods inside
    // React's own source, which happen to share the 3-param shape.
    const isInModuleMap = (path: NodePath): boolean => {
        const objectParent = path.parentPath;
        if (!objectParent || !objectParent.isObjectExpression()) return false;
        // The ObjectExpression's parent should be the module-map assignment:
        //   var e = { 540: fn, 338: fn, ... }
        // i.e. a VariableDeclarator whose init is the object.
        const objHolder = objectParent.parentPath;
        if (!objHolder) return false;
        if (objHolder.isVariableDeclarator()) return true;
        // Some bundles place the map directly inside the IIFE arrow body's
        // return / argument position — accept those too.
        if (objHolder.isAssignmentExpression()) return true;
        return false;
    };

    traverse(ast, {
        ObjectProperty(path) {
            if (!t.isNumericLiteral(path.node.key)) return;
            if (!isInModuleMap(path)) return;
            const value = path.node.value;
            if (!t.isFunctionExpression(value) && !t.isArrowFunctionExpression(value)) return;
            const id = String((path.node.key as t.NumericLiteral).value);
            const valuePath = path.get("value") as NodePath<t.Function>;
            captureModule(
                id,
                valuePath,
                (value as t.FunctionExpression | t.ArrowFunctionExpression).params
            );
        },
        ObjectMethod(path) {
            if (!t.isNumericLiteral(path.node.key)) return;
            if (!isInModuleMap(path)) return;
            const id = String((path.node.key as t.NumericLiteral).value);
            captureModule(id, path as unknown as NodePath<t.Function>, path.node.params);
        },
    });

    const catalog = new Map<string, ModuleCatalogEntry>();
    const exportCollections = new Map<string, Array<{ key: string; local: string }>>();

    // Track which modules are pure re-exporters: body of form
    //   e.exports = t(N)
    // → reExportTargetOf[mod.id] = "N"
    const reExportTargetOf = new Map<string, string>();

    for (const mod of modules) {
        const exportsMap = new Map<string, string>();
        const exportsParamAssignKeys = new Set<string>();
        let dispatchCallCount = 0;
        let reExportTarget: string | null = null;

        // Quick re-export detection: a module whose ONLY non-trivial statement
        // is `<module>.exports = <require>(<n>)`.
        const body = mod.fnPath.node.body;
        if (t.isBlockStatement(body)) {
            for (const stmt of body.body) {
                if (!t.isExpressionStatement(stmt)) continue;
                const expr = stmt.expression;
                if (
                    t.isAssignmentExpression(expr) &&
                    t.isMemberExpression(expr.left) &&
                    t.isIdentifier(expr.left.object, { name: mod.moduleParam }) &&
                    t.isIdentifier(expr.left.property, { name: "exports" }) &&
                    t.isCallExpression(expr.right) &&
                    t.isIdentifier(expr.right.callee) &&
                    mod.requireParam &&
                    (expr.right.callee as t.Identifier).name === mod.requireParam &&
                    expr.right.arguments.length === 1 &&
                    t.isNumericLiteral(expr.right.arguments[0])
                ) {
                    reExportTarget = String((expr.right.arguments[0] as t.NumericLiteral).value);
                    break;
                }
            }
        }
        if (reExportTarget) {
            reExportTargetOf.set(mod.id, reExportTarget);
        }

        mod.fnPath.traverse({
            CallExpression(p) {
                const node = p.node;
                // <require>.d(<exports>, { ... })
                if (
                    mod.requireParam &&
                    t.isMemberExpression(node.callee) &&
                    t.isIdentifier((node.callee as t.MemberExpression).object, { name: mod.requireParam }) &&
                    t.isIdentifier((node.callee as t.MemberExpression).property, { name: "d" }) &&
                    node.arguments.length === 2 &&
                    t.isIdentifier(node.arguments[0], { name: mod.exportsParam }) &&
                    t.isObjectExpression(node.arguments[1])
                ) {
                    for (const prop of node.arguments[1].properties) {
                        if (!t.isObjectProperty(prop)) continue;
                        const k = getStaticKey(prop.key);
                        if (!k) continue;
                        const local = extractGetterLocal(prop.value);
                        if (!local) continue;
                        exportsMap.set(k, local);
                    }
                    return;
                }
                // Object.defineProperty(<exports>, "k", { get: ... })
                if (
                    t.isMemberExpression(node.callee) &&
                    t.isIdentifier((node.callee as t.MemberExpression).object, { name: "Object" }) &&
                    t.isIdentifier((node.callee as t.MemberExpression).property, { name: "defineProperty" }) &&
                    node.arguments.length === 3 &&
                    t.isIdentifier(node.arguments[0], { name: mod.exportsParam }) &&
                    t.isStringLiteral(node.arguments[1]) &&
                    t.isObjectExpression(node.arguments[2])
                ) {
                    const k = (node.arguments[1] as t.StringLiteral).value;
                    for (const prop of (node.arguments[2] as t.ObjectExpression).properties) {
                        if (!t.isObjectProperty(prop)) continue;
                        if (getStaticKey(prop.key) !== "get") continue;
                        const local = extractGetterLocal(prop.value);
                        if (!local) continue;
                        exportsMap.set(k, local);
                    }
                    return;
                }
                // Call shape: <X>.current.<hookName>(args) — react dispatch
                if (
                    t.isMemberExpression(node.callee) &&
                    t.isMemberExpression((node.callee as t.MemberExpression).object) &&
                    t.isIdentifier(
                        ((node.callee as t.MemberExpression).object as t.MemberExpression).property,
                        { name: "current" }
                    ) &&
                    t.isIdentifier((node.callee as t.MemberExpression).property) &&
                    REACT_HOOK_NAMES.has(((node.callee as t.MemberExpression).property as t.Identifier).name)
                ) {
                    dispatchCallCount++;
                }
            },
            AssignmentExpression(p) {
                // <exportsParam>.K = ...  (module-scope assignment to exports)
                const left = p.node.left;
                if (
                    t.isMemberExpression(left) &&
                    t.isIdentifier(left.object, { name: mod.exportsParam }) &&
                    t.isIdentifier(left.property)
                ) {
                    const minLocal = (left.property as t.Identifier).name;
                    exportsParamAssignKeys.add(minLocal);
                    // If the RHS is `<ident>.<canonicalName>`, learn that the
                    // exports name `minLocal` corresponds to that canonical
                    // name. e.g. `n.H = r.createRoot` ⇒ exportsMap["createRoot"] = "H".
                    const right = p.node.right;
                    if (t.isMemberExpression(right) && t.isIdentifier(right.property)) {
                        const canonical = (right.property as t.Identifier).name;
                        if (!exportsMap.has(canonical)) {
                            exportsMap.set(canonical, minLocal);
                        }
                    }
                }
            },
        });

        let kind: ModuleKind | null = null;
        if (dispatchCallCount > 0) {
            kind = "react";
        } else if (
            (exportsParamAssignKeys.has("jsx") && exportsParamAssignKeys.has("jsxs")) ||
            (exportsMap.has("jsx") && exportsMap.has("jsxs"))
        ) {
            kind = "react/jsx-runtime";
        } else if (exportsParamAssignKeys.has("createRoot") || exportsMap.has("createRoot")) {
            kind = "react-dom/client";
        }

        if (kind) {
            catalog.set(mod.id, { kind, exportMap: exportsMap });
        }

        if (exportsMap.size > 0) {
            const arr: Array<{ key: string; local: string }> = [];
            for (const [k, v] of exportsMap) arr.push({ key: k, local: v });
            exportCollections.set(mod.id, arr);
        }
    }

    // Resolve re-export chains: if module M is `e.exports = t(N)` and N is
    // classified, M inherits N's kind. Iterate until no new classifications.
    let changed = true;
    while (changed) {
        changed = false;
        for (const [source, target] of reExportTargetOf) {
            if (catalog.has(source)) continue;
            const tgt = catalog.get(target);
            if (tgt) {
                catalog.set(source, { kind: tgt.kind, exportMap: tgt.exportMap });
                changed = true;
            }
        }
    }

    const reactImports = new Set<string>();
    const jsxRuntimeImports = new Set<string>();
    const reactDomImports = new Set<string>();

    for (const mod of modules) {
        if (!mod.requireParam) continue; // 2-param modules can't have require()
        const localAliases = new Map<string, { kind: ModuleKind; entry: ModuleCatalogEntry }>();

        mod.fnPath.traverse({
            VariableDeclarator(p) {
                const id = p.node.id;
                const init = p.node.init;
                if (
                    t.isIdentifier(id) &&
                    init &&
                    t.isCallExpression(init) &&
                    t.isIdentifier(init.callee, { name: mod.requireParam }) &&
                    init.arguments.length === 1 &&
                    t.isNumericLiteral(init.arguments[0])
                ) {
                    const requireId = String((init.arguments[0] as t.NumericLiteral).value);
                    const entry = catalog.get(requireId);
                    if (entry) {
                        localAliases.set(id.name, { kind: entry.kind, entry });
                    }
                }
            },
        });

        mod.fnPath.traverse({
            CallExpression: {
                exit(p) {
                    const node = p.node;

                    if (
                        t.isIdentifier(node.callee, { name: mod.requireParam }) &&
                        node.arguments.length === 1 &&
                        t.isNumericLiteral(node.arguments[0])
                    ) {
                        const numId = (node.arguments[0] as t.NumericLiteral).value;
                        p.replaceWith(
                            t.callExpression(t.identifier("require"), [t.stringLiteral(`./${numId}.js`)])
                        );
                        return;
                    }

                    if (
                        t.isMemberExpression(node.callee) &&
                        t.isIdentifier((node.callee as t.MemberExpression).object, { name: mod.requireParam }) &&
                        t.isIdentifier((node.callee as t.MemberExpression).property, { name: "d" }) &&
                        node.arguments.length === 2 &&
                        t.isIdentifier(node.arguments[0], { name: mod.exportsParam })
                    ) {
                        p.replaceWith(t.identifier("void 0"));
                        return;
                    }

                    if (
                        t.isMemberExpression(node.callee) &&
                        t.isIdentifier((node.callee as t.MemberExpression).object, { name: "Object" }) &&
                        t.isIdentifier((node.callee as t.MemberExpression).property, { name: "defineProperty" }) &&
                        node.arguments.length === 3 &&
                        t.isIdentifier(node.arguments[0], { name: mod.exportsParam })
                    ) {
                        p.replaceWith(t.identifier("void 0"));
                        return;
                    }

                    if (
                        t.isSequenceExpression(node.callee) &&
                        node.callee.expressions.length === 2 &&
                        t.isNumericLiteral(node.callee.expressions[0], { value: 0 }) &&
                        (t.isMemberExpression(node.callee.expressions[1]) ||
                            t.isIdentifier(node.callee.expressions[1]))
                    ) {
                        const inner = node.callee.expressions[1] as t.Expression;
                        // If the MemberExpression visitor already rewrote the
                        // member to a bare Identifier, just strip the `(0, …)`
                        // wrapper. Otherwise pass through the recognition pass.
                        const callee = t.isMemberExpression(inner)
                            ? rewriteRecognisedMember(
                                  inner,
                                  localAliases,
                                  reactImports,
                                  jsxRuntimeImports,
                                  reactDomImports
                              )
                            : inner;
                        p.replaceWith(t.callExpression(callee, node.arguments));
                        return;
                    }

                    if (t.isMemberExpression(node.callee)) {
                        const member = node.callee as t.MemberExpression;
                        if (t.isIdentifier(member.object) && localAliases.has(member.object.name)) {
                            const newCallee = rewriteRecognisedMember(
                                member,
                                localAliases,
                                reactImports,
                                jsxRuntimeImports,
                                reactDomImports
                            );
                            // Only replace when the callee changed; otherwise
                            // we'd rebuild the same node and traverse would loop.
                            if (newCallee !== member) {
                                p.replaceWith(t.callExpression(newCallee, node.arguments));
                            }
                            return;
                        }
                    }
                },
            },

            MemberExpression: {
                exit(p) {
                    if (p.parent && t.isCallExpression(p.parent) && p.parent.callee === p.node) return;
                    if (!t.isIdentifier(p.node.object) || !t.isIdentifier(p.node.property)) return;
                    const aliased = localAliases.get((p.node.object as t.Identifier).name);
                    if (!aliased) return;
                    const prop = (p.node.property as t.Identifier).name;
                    if (aliased.kind === "react/jsx-runtime" && JSX_RUNTIME_NAMES.has(prop)) {
                        jsxRuntimeImports.add(prop);
                        p.replaceWith(t.identifier(prop));
                        return;
                    }
                    if (aliased.kind === "react") {
                        if (REACT_HOOK_NAMES.has(prop) || REACT_TOP_LEVEL_API_NAMES.has(prop)) {
                            reactImports.add(prop);
                            p.replaceWith(t.identifier(prop));
                            return;
                        }
                    }
                    if (aliased.kind === "react-dom/client") {
                        for (const [canonical, minLocal] of aliased.entry.exportMap) {
                            if (minLocal === prop && REACT_DOM_CLIENT_NAMES.has(canonical)) {
                                reactDomImports.add(canonical);
                                p.replaceWith(t.identifier(canonical));
                                return;
                            }
                        }
                    }
                },
            },
        });
    }

    // ──────────────────────────────────────────────────────────────────
    // Pass 4 (global): catch IIFE-level `var X = <any>(<numericId>)` aliases
    // and rewrite the user-entry callsites at the outermost scope, which the
    // per-module pass cannot reach because the entry-IIFE wrapper has 0 params
    // (no positional require). The catalog match keeps this safe — only known
    // React-family module IDs trigger alias substitution.
    // ──────────────────────────────────────────────────────────────────

    const globalAliases = new Map<string, { kind: ModuleKind; entry: ModuleCatalogEntry }>();

    traverse(ast, {
        VariableDeclarator(p) {
            const id = p.node.id;
            const init = p.node.init;
            if (
                t.isIdentifier(id) &&
                init &&
                t.isCallExpression(init) &&
                t.isIdentifier(init.callee) &&
                init.arguments.length === 1 &&
                t.isNumericLiteral(init.arguments[0])
            ) {
                const requireId = String((init.arguments[0] as t.NumericLiteral).value);
                const entry = catalog.get(requireId);
                if (entry) {
                    globalAliases.set(id.name, { kind: entry.kind, entry });
                }
            }
        },
    });

    if (globalAliases.size > 0) {
        traverse(ast, {
            CallExpression: {
                exit(p) {
                    const node = p.node;
                    if (
                        t.isSequenceExpression(node.callee) &&
                        node.callee.expressions.length === 2 &&
                        t.isNumericLiteral(node.callee.expressions[0], { value: 0 }) &&
                        (t.isMemberExpression(node.callee.expressions[1]) ||
                            t.isIdentifier(node.callee.expressions[1]))
                    ) {
                        const inner = node.callee.expressions[1] as t.Expression;
                        const callee = t.isMemberExpression(inner)
                            ? rewriteRecognisedMember(
                                  inner,
                                  globalAliases,
                                  reactImports,
                                  jsxRuntimeImports,
                                  reactDomImports
                              )
                            : inner;
                        p.replaceWith(t.callExpression(callee, node.arguments));
                        return;
                    }
                    if (t.isMemberExpression(node.callee)) {
                        const member = node.callee as t.MemberExpression;
                        if (t.isIdentifier(member.object) && globalAliases.has((member.object as t.Identifier).name)) {
                            const newCallee = rewriteRecognisedMember(
                                member,
                                globalAliases,
                                reactImports,
                                jsxRuntimeImports,
                                reactDomImports
                            );
                            if (newCallee !== member) {
                                p.replaceWith(t.callExpression(newCallee, node.arguments));
                            }
                            return;
                        }
                    }
                },
            },
            MemberExpression: {
                exit(p) {
                    if (p.parent && t.isCallExpression(p.parent) && p.parent.callee === p.node) return;
                    if (!t.isIdentifier(p.node.object) || !t.isIdentifier(p.node.property)) return;
                    const aliased = globalAliases.get((p.node.object as t.Identifier).name);
                    if (!aliased) return;
                    const prop = (p.node.property as t.Identifier).name;
                    if (aliased.kind === "react/jsx-runtime" && JSX_RUNTIME_NAMES.has(prop)) {
                        jsxRuntimeImports.add(prop);
                        p.replaceWith(t.identifier(prop));
                        return;
                    }
                    if (aliased.kind === "react" && (REACT_HOOK_NAMES.has(prop) || REACT_TOP_LEVEL_API_NAMES.has(prop))) {
                        reactImports.add(prop);
                        p.replaceWith(t.identifier(prop));
                        return;
                    }
                    if (aliased.kind === "react-dom/client") {
                        for (const [canonical, minLocal] of aliased.entry.exportMap) {
                            if (minLocal === prop && REACT_DOM_CLIENT_NAMES.has(canonical)) {
                                reactDomImports.add(canonical);
                                p.replaceWith(t.identifier(canonical));
                                return;
                            }
                        }
                    }
                },
            },
        });
    }

    let codeCopy = generate(ast).code;

    const importLines: string[] = [];
    if (reactImports.size > 0) {
        importLines.push(`import { ${Array.from(reactImports).sort().join(", ")} } from "react";`);
    }
    if (jsxRuntimeImports.size > 0) {
        importLines.push(`import { ${Array.from(jsxRuntimeImports).sort().join(", ")} } from "react/jsx-runtime";`);
    }
    if (reactDomImports.size > 0) {
        importLines.push(`import { ${Array.from(reactDomImports).sort().join(", ")} } from "react-dom/client";`);
    }
    const header = importLines.length > 0 ? `${importLines.join("\n")}\n\n` : "";

    const allExports: Array<{ key: string; local: string }> = [];
    for (const arr of exportCollections.values()) allExports.push(...arr);

    let trailingExports = "";
    if (allExports.length > 0) {
        const usedKeys = new Set<string>();
        const usedLocals = new Set<string>();
        const named: Array<{ key: string; local: string }> = [];
        let collisionIndex = 0;
        const defaultLines: string[] = [];
        for (const entry of allExports) {
            if (usedLocals.has(entry.local)) continue;
            usedLocals.add(entry.local);
            let key = entry.key;
            if (usedKeys.has(key)) {
                collisionIndex += 1;
                key = `${entry.key}_${collisionIndex}`;
            }
            usedKeys.add(key);
            if (key === "default") {
                defaultLines.push(`export default ${entry.local};`);
            } else {
                named.push({ key, local: entry.local });
            }
        }
        const parts: string[] = [];
        if (named.length > 0) {
            const namedList = named
                .map(({ key, local }) => (key === local ? key : `${local} as ${key}`))
                .join(", ");
            parts.push(`/* webpack-derived exports — keys may collide across modules in the chunk */`);
            parts.push(`export { ${namedList} };`);
        }
        parts.push(...defaultLines);
        if (parts.length > 0) trailingExports = `\n\n${parts.join("\n")}`;
    } else {
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
        if (functionName) trailingExports = `\n\nexport default ${functionName};`;
    }

    return `${header}${codeCopy}${trailingExports}`;
};

const rewriteRecognisedMember = (
    member: t.MemberExpression,
    localAliases: Map<string, { kind: ModuleKind; entry: ModuleCatalogEntry }>,
    reactImports: Set<string>,
    jsxImports: Set<string>,
    reactDomImports: Set<string>
): t.Expression => {
    if (!t.isIdentifier(member.object) || !t.isIdentifier(member.property)) return member;
    const aliased = localAliases.get((member.object as t.Identifier).name);
    if (!aliased) return member;
    const prop = (member.property as t.Identifier).name;

    if (aliased.kind === "react" && (REACT_HOOK_NAMES.has(prop) || REACT_TOP_LEVEL_API_NAMES.has(prop))) {
        reactImports.add(prop);
        return t.identifier(prop);
    }
    if (aliased.kind === "react/jsx-runtime" && JSX_RUNTIME_NAMES.has(prop)) {
        jsxImports.add(prop);
        return t.identifier(prop);
    }
    if (aliased.kind === "react-dom/client") {
        for (const [canonical, minLocal] of aliased.entry.exportMap) {
            if (minLocal === prop && REACT_DOM_CLIENT_NAMES.has(canonical)) {
                reactDomImports.add(canonical);
                return t.identifier(canonical);
            }
        }
    }
    return member;
};

const getStaticKey = (node: t.Node): string | null => {
    if (t.isIdentifier(node)) return node.name;
    if (t.isStringLiteral(node)) return node.value;
    if (t.isNumericLiteral(node)) return String(node.value);
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
