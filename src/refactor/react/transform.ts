import { NodePath } from "@babel/traverse";
import _traverse from "@babel/traverse";
import _generator from "@babel/generator";
import * as t from "@babel/types";
import {
    tryExtractModuleExportsAssignment,
    tryExtractExportsAssignment,
    tryExtractRequireCall,
    buildModuleExportStatement,
    makeNamedExportStatement,
} from "./helpers.js";
import {
    LibraryModuleInfo,
    LibraryType,
    REACT_CANONICAL,
    JSX_RUNTIME_CANONICAL,
    REACT_DOM_CLIENT_CANONICAL,
    librarySource,
} from "./library-classify.js";

const traverse = _traverse.default;
const generate = _generator.default;

export type ModuleEntry = {
    id: string;
    fnPath: NodePath<t.FunctionExpression | t.ArrowFunctionExpression> | NodePath<t.ObjectMethod>;
    paramCount: number;
    moduleParam: string;
    exportsParam: string;
    requireParam: string | undefined;
};

/**
 * Transforms a single webpack module function into an array of ES module statements.
 *
 * Four passes (all top-level only to avoid placing exports inside nested functions):
 *   1. `<moduleParam>.exports = <rhs>` → `export * from` or `export default`
 *   2. `<exportsParam>.<prop> = <rhs>` → named export (all modules with an exportsParam)
 *   3. Hoist `var x = <requireParam>(N)` to static `import * as x from "./N.js"`
 *   4. Replace remaining inline `<requireParam>(N)` calls with the hoisted name
 */
export const transformModule = (mod: ModuleEntry): t.Statement[] => {
    const { fnPath, moduleParam, exportsParam, requireParam } = mod;
    const body = fnPath.node.body;
    if (!t.isBlockStatement(body)) return [];

    // Pass 1 — handle `<moduleParam>.exports = <rhs>` at the top level only.
    if (moduleParam) {
        const next: t.Statement[] = [];
        for (const stmt of body.body) {
            if (!t.isExpressionStatement(stmt)) {
                next.push(stmt);
                continue;
            }
            const expr = stmt.expression;

            const directRhs = tryExtractModuleExportsAssignment(expr, moduleParam);
            if (directRhs) {
                next.push(buildModuleExportStatement(directRhs, requireParam));
                continue;
            }

            if (t.isSequenceExpression(expr)) {
                let hadMatch = false;
                const splitted: t.Statement[] = [];
                for (const sub of expr.expressions) {
                    const rhs = tryExtractModuleExportsAssignment(sub, moduleParam);
                    if (rhs) {
                        hadMatch = true;
                        splitted.push(buildModuleExportStatement(rhs, requireParam));
                    } else {
                        splitted.push(t.expressionStatement(sub as t.Expression));
                    }
                }
                if (hadMatch) {
                    next.push(...splitted);
                    continue;
                }
            }
            next.push(stmt);
        }
        body.body = next;
    }

    // Pass 2 — handle `<exportsParam>.<propName> = <rhs>` at the top level only.
    if (exportsParam) {
        const next: t.Statement[] = [];
        for (const stmt of body.body) {
            if (!t.isExpressionStatement(stmt)) {
                next.push(stmt);
                continue;
            }
            const expr = stmt.expression;

            const direct = tryExtractExportsAssignment(expr, exportsParam);
            if (direct) {
                next.push(makeNamedExportStatement(direct.propName, direct.rhs));
                continue;
            }

            if (t.isSequenceExpression(expr)) {
                const splitted: t.Statement[] = [];
                for (const sub of expr.expressions) {
                    const match = tryExtractExportsAssignment(sub, exportsParam);
                    if (match) {
                        splitted.push(makeNamedExportStatement(match.propName, match.rhs));
                    } else {
                        splitted.push(t.expressionStatement(sub as t.Expression));
                    }
                }
                next.push(...splitted);
                continue;
            }
            next.push(stmt);
        }
        body.body = next;
    }

    // Pass 3 — hoist top-level `var <name> = <requireParam>(N)` to static imports.
    // moduleSpec → importName
    const hoistedImports = new Map<string, string>();
    // numId → canonical importName (used by Pass 4 for inline replacements)
    const importNameByNumId = new Map<number, string>();

    if (requireParam) {
        const next: t.Statement[] = [];
        for (const stmt of body.body) {
            if (!t.isVariableDeclaration(stmt)) {
                next.push(stmt);
                continue;
            }
            const kept: t.VariableDeclarator[] = [];
            for (const decl of stmt.declarations) {
                if (!t.isIdentifier(decl.id) || !decl.init) {
                    kept.push(decl);
                    continue;
                }
                const numId = tryExtractRequireCall(decl.init, requireParam);
                if (numId === null) {
                    kept.push(decl);
                    continue;
                }
                const spec = `./${numId}.js`;
                if (!hoistedImports.has(spec)) {
                    hoistedImports.set(spec, decl.id.name);
                    importNameByNumId.set(numId, decl.id.name);
                }
                // declarator removed (it becomes the static import)
            }
            if (kept.length > 0) {
                next.push(t.variableDeclaration(stmt.kind, kept));
            }
        }
        body.body = next;
    }

    // Pass 4 — replace any remaining inline `<requireParam>(N)` calls with a synthesized
    // namespace import reference.
    if (requireParam) {
        fnPath.traverse({
            CallExpression(p) {
                const numId = tryExtractRequireCall(p.node, requireParam);
                if (numId === null) return;
                let name = importNameByNumId.get(numId);
                if (!name) {
                    name = `_jsr_module_${numId}`;
                    hoistedImports.set(`./${numId}.js`, name);
                    importNameByNumId.set(numId, name);
                }
                p.replaceWith(t.identifier(name));
                p.skip();
            },
        });
    }

    // Step 5 — strip outer function wrapper, prepend hoisted static imports.
    const importStmts: t.Statement[] = [];
    for (const [spec, name] of hoistedImports) {
        importStmts.push(t.importDeclaration([t.importNamespaceSpecifier(t.identifier(name))], t.stringLiteral(spec)));
    }

    return [...importStmts, ...body.body];
};

// Returns true when fn matches the webpack runtime require helper:
//   function X(id) { … return (moduleMap[id](mod, mod.exports, X), mod.exports); }
// The key signal is the final return statement: a SequenceExpression whose first element
// is a computed-member CallExpression and whose second is a `<var>.exports` MemberExpression.
const isWebpackRequireHelper = (fn: t.FunctionDeclaration): boolean => {
    if (fn.params.length !== 1) return false;
    for (const stmt of fn.body.body) {
        if (!t.isReturnStatement(stmt) || !stmt.argument) continue;
        const arg = stmt.argument;
        if (!t.isSequenceExpression(arg) || arg.expressions.length !== 2) continue;
        const [first, second] = arg.expressions;
        if (!t.isCallExpression(first)) continue;
        if (!t.isMemberExpression(first.callee) || !(first.callee as t.MemberExpression).computed) continue;
        if (!t.isMemberExpression(second)) continue;
        if (!t.isIdentifier((second as t.MemberExpression).property, { name: "exports" })) continue;
        return true;
    }
    return false;
};

// ---------------------------------------------------------------------------
// Pass D helpers — library-aware call-site rewriting
// ---------------------------------------------------------------------------

/** Resolves the canonical name for an accessed property on a library-bound local var.
 *  Returns null if the var is not a known library or the prop has no canonical mapping. */
function resolveLibraryProp(
    varName: string,
    prop: string,
    varToLib: Map<string, LibraryModuleInfo>
): { canonical: string; libType: LibraryType } | null {
    const info = varToLib.get(varName);
    if (!info || info.type === "unknown") return null;

    // Helper: is this name actually a canonical export for this library type?
    const isCanonical = (name: string): boolean => {
        if (info.type === "react") return REACT_CANONICAL.has(name);
        if (info.type === "react-jsx-runtime") return JSX_RUNTIME_CANONICAL.has(name);
        if (info.type === "react-dom-client") return REACT_DOM_CLIENT_CANONICAL.has(name);
        return false;
    };

    // Check exportMap: only trust the value if it IS a canonical name.
    // (Avoids mapping e.g. n.jsx = i → canonical 'i' when i is just a local fn.)
    const viaMap = info.exportMap.get(prop);
    if (viaMap && isCanonical(viaMap)) return { canonical: viaMap, libType: info.type };

    // Fall back to checking the prop name itself (handles cases where the exported
    // property name is already the canonical name, e.g. n.jsx = <iife>).
    if (isCanonical(prop)) return { canonical: prop, libType: info.type };

    return null;
}

/** Extracts `varName` and `prop` from a `(0, varName.prop)` or `varName.prop` callee. */
function tryExtractMemberCallee(callee: t.Expression): { varName: string; prop: string } | null {
    // (0, X.Y) form
    if (t.isSequenceExpression(callee) && callee.expressions.length === 2) {
        const [first, second] = callee.expressions;
        if (t.isNumericLiteral(first) && first.value === 0 && t.isMemberExpression(second)) {
            const obj = second.object;
            const prop = second.property;
            if (t.isIdentifier(obj) && t.isIdentifier(prop) && !second.computed) {
                return { varName: obj.name, prop: prop.name };
            }
        }
    }
    // X.Y form
    if (t.isMemberExpression(callee) && !callee.computed) {
        const obj = callee.object;
        const prop = callee.property;
        if (t.isIdentifier(obj) && t.isIdentifier(prop)) {
            return { varName: obj.name, prop: prop.name };
        }
    }
    return null;
}

/**
 * Pass D – rewrite library calls and collect which named exports are needed.
 *
 * Traverses all statements; for every `(0, X.Y)(args)` or `X.Y(args)` where X is a
 * known library local var, replaces the callee with the canonical identifier and records
 * the needed named import.  Also rewrites bare member expressions `X.Y` that are NOT in a
 * call position (e.g. passed as a value to another function).
 *
 * Returns the set of named exports needed per library type so the caller can build
 * proper `import { ... } from "..."` declarations.
 */
function rewriteLibraryCalls(
    statements: t.Statement[],
    varToLib: Map<string, LibraryModuleInfo>
): Map<string, Set<string>> {
    // libType → set of canonical export names actually used
    const usedExports = new Map<string, Set<string>>();

    const record = (libType: LibraryType, name: string) => {
        const src = librarySource(libType);
        if (!src) return;
        if (!usedExports.has(src)) usedExports.set(src, new Set());
        usedExports.get(src)!.add(name);
    };

    const syntheticFile = t.file(t.program(statements, [], "module"));
    traverse(syntheticFile, {
        CallExpression(p) {
            const info = tryExtractMemberCallee(p.node.callee as t.Expression);
            if (!info) return;
            const resolved = resolveLibraryProp(info.varName, info.prop, varToLib);
            if (!resolved) return;
            record(resolved.libType, resolved.canonical);
            // Replace (0, X.Y)(...) or X.Y(...) with canonicalName(...)
            p.node.callee = t.identifier(resolved.canonical);
            p.skip();
        },
        MemberExpression(p) {
            // Rewrite X.Y in non-call positions (e.g. passed as callback value)
            if (p.parent && t.isCallExpression(p.parent) && p.parent.callee === p.node) return; // handled above
            const obj = p.node.object;
            const prop = p.node.property;
            if (!t.isIdentifier(obj) || !t.isIdentifier(prop) || p.node.computed) return;
            const resolved = resolveLibraryProp(obj.name, prop.name, varToLib);
            if (!resolved) return;
            record(resolved.libType, resolved.canonical);
            p.replaceWith(t.identifier(resolved.canonical));
            p.skip();
        },
    });

    return usedExports;
}

// ---------------------------------------------------------------------------
// Pass E — Babel slicedToArray collapse
// ---------------------------------------------------------------------------

/** Returns true if the last arm of a `||` chain is an IIFE that throws TypeError. */
function isSlicedToArrayTail(node: t.Node): boolean {
    if (!t.isCallExpression(node) || node.arguments.length !== 0) return false;
    const callee = node.callee;
    if (!t.isFunctionExpression(callee) && !t.isArrowFunctionExpression(callee)) return false;
    const body = callee.body;
    if (!t.isBlockStatement(body)) return false;
    return body.body.some(
        s =>
            t.isThrowStatement(s) &&
            t.isNewExpression(s.argument) &&
            t.isIdentifier((s.argument as t.NewExpression).callee, { name: "TypeError" })
    );
}

function hasSlicedToArrayTail(node: t.Node): boolean {
    if (isSlicedToArrayTail(node)) return true;
    if (t.isLogicalExpression(node) && node.operator === "||") return hasSlicedToArrayTail(node.right);
    return false;
}

/**
 * Tries to detect a `var <temps>, resultVar = (<seqExpr>), target0 = resultVar[0], ...`
 * pattern produced by Babel's slicedToArray expansion.
 *
 * Returns `{ actualExpr, resultVar, targets }` on match, or null.
 */
function tryDetectSlicedToArray(decl: t.VariableDeclaration): {
    actualExpr: t.Expression;
    resultVar: string;
    targets: Array<{ id: t.Identifier; index: number }>;
} | null {
    let resultVar: string | null = null;
    let actualExpr: t.Expression | null = null;

    for (const d of decl.declarations) {
        if (!d.init || !t.isSequenceExpression(d.init)) continue;
        const exprs = d.init.expressions;
        if (exprs.length < 3) continue;
        // exprs[0]: tempVar = <actualCall>
        if (!t.isAssignmentExpression(exprs[0]) || (exprs[0] as t.AssignmentExpression).operator !== "=") continue;
        const firstAssign = exprs[0] as t.AssignmentExpression;
        if (!t.isIdentifier(firstAssign.left)) continue;
        // exprs[1]: countVar = <number>
        if (!t.isAssignmentExpression(exprs[1]) || !t.isNumericLiteral((exprs[1] as t.AssignmentExpression).right)) continue;
        // last expr: the TypeError IIFE (possibly nested in || chain)
        if (!hasSlicedToArrayTail(exprs[exprs.length - 1])) continue;

        resultVar = t.isIdentifier(d.id) ? d.id.name : null;
        if (!resultVar) continue;
        actualExpr = firstAssign.right as t.Expression;
        break;
    }

    if (!resultVar || !actualExpr) return null;

    const targets: Array<{ id: t.Identifier; index: number }> = [];
    for (const d of decl.declarations) {
        if (!d.init || !t.isMemberExpression(d.init)) continue;
        if (!t.isIdentifier(d.init.object, { name: resultVar })) continue;
        if (!d.init.computed || !t.isNumericLiteral(d.init.property)) continue;
        if (!t.isIdentifier(d.id)) continue;
        targets.push({ id: d.id as t.Identifier, index: (d.init.property as t.NumericLiteral).value });
    }

    return targets.length > 0 ? { actualExpr, resultVar, targets } : null;
}

/** Collapse Babel slicedToArray expansions in a statement list (including nested blocks). */
function collapseSlicedToArray(statements: t.Statement[]): t.Statement[] {
    const out: t.Statement[] = [];
    for (const stmt of statements) {
        // Recurse into block statements (e.g. if/else, function bodies handled via traversal)
        if (t.isBlockStatement(stmt)) {
            stmt.body = collapseSlicedToArray(stmt.body);
            out.push(stmt);
            continue;
        }

        if (!t.isVariableDeclaration(stmt)) {
            out.push(stmt);
            continue;
        }

        const match = tryDetectSlicedToArray(stmt);
        if (!match) {
            out.push(stmt);
            continue;
        }

        const { actualExpr, resultVar, targets } = match;
        // Sort targets by index so array pattern elements are in order
        const sorted = [...targets].sort((a, b) => a.index - b.index);
        const pattern = t.arrayPattern(sorted.map(tgt => tgt.id as unknown as t.PatternLike));
        out.push(t.variableDeclaration("const", [t.variableDeclarator(pattern, actualExpr)]));
    }
    return out;
}

/** Traverse all function bodies in a statement list and collapse slicedToArray inside them. */
function collapseSlicedToArrayDeep(statements: t.Statement[]): t.Statement[] {
    // First collapse top-level
    const top = collapseSlicedToArray(statements);
    // Then recurse into function bodies via a traverse
    const syntheticFile = t.file(t.program(top, [], "module"));
    traverse(syntheticFile, {
        BlockStatement(p) {
            const collapsed = collapseSlicedToArray(p.node.body);
            if (collapsed !== p.node.body) {
                p.node.body = collapsed;
            }
        },
    });
    return top;
}

// ---------------------------------------------------------------------------
// Pass F — JSX recovery
// ---------------------------------------------------------------------------

function exprToJsxName(expr: t.Expression): t.JSXIdentifier | t.JSXMemberExpression | null {
    if (t.isStringLiteral(expr)) return t.jsxIdentifier(expr.value);
    if (t.isIdentifier(expr)) return t.jsxIdentifier(expr.name);
    if (t.isMemberExpression(expr) && !expr.computed && t.isIdentifier(expr.property)) {
        const obj = exprToJsxName(expr.object as t.Expression);
        if (obj) return t.jsxMemberExpression(obj as t.JSXIdentifier | t.JSXMemberExpression, t.jsxIdentifier((expr.property as t.Identifier).name));
    }
    return null;
}

function exprToJsxAttrValue(expr: t.Expression): t.JSXExpressionContainer | t.StringLiteral {
    if (t.isStringLiteral(expr)) return expr;
    return t.jsxExpressionContainer(expr);
}

function childToJsxChild(child: t.Expression): t.JSXElement | t.JSXFragment | t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild | null {
    if (t.isStringLiteral(child)) {
        // Convert to JSXText. Trim internal whitespace into single spaces but preserve content.
        return t.jsxText(child.value);
    }
    if (t.isJSXElement(child) || t.isJSXFragment(child)) return child;
    return t.jsxExpressionContainer(child);
}

function tryConvertToJSX(call: t.CallExpression): t.JSXElement | null {
    const callee = call.callee;
    if (!t.isIdentifier(callee)) return null;
    if (callee.name !== "jsx" && callee.name !== "jsxs" && callee.name !== "jsxDEV") return null;
    if (call.arguments.length < 2) return null;

    const tagArg = call.arguments[0] as t.Expression;
    const propsArg = call.arguments[1] as t.Expression;

    const jsxName = exprToJsxName(tagArg);
    if (!jsxName) return null;

    const attrs: t.JSXAttribute[] = [];
    type JSXChild = t.JSXElement | t.JSXFragment | t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild;
    const children: JSXChild[] = [];

    if (t.isObjectExpression(propsArg)) {
        for (const prop of propsArg.properties) {
            if (!t.isObjectProperty(prop) || prop.computed) continue;
            const keyNode = prop.key;
            const valNode = prop.value as t.Expression;
            const keyName = t.isIdentifier(keyNode) ? keyNode.name : t.isStringLiteral(keyNode) ? keyNode.value : null;
            if (!keyName) continue;

            if (keyName === "children") {
                // children can be a single value or an array
                if (t.isArrayExpression(valNode)) {
                    for (const el of valNode.elements) {
                        if (!el) continue;
                        const ch = childToJsxChild(el as t.Expression);
                        if (ch) children.push(ch);
                    }
                } else {
                    const ch = childToJsxChild(valNode);
                    if (ch) children.push(ch);
                }
                continue;
            }

            // Normal prop
            const attrName = t.jsxIdentifier(keyName);
            if (t.isJSXExpressionContainer(valNode) || t.isStringLiteral(valNode)) {
                attrs.push(t.jsxAttribute(attrName, exprToJsxAttrValue(valNode)));
            } else {
                attrs.push(t.jsxAttribute(attrName, exprToJsxAttrValue(valNode)));
            }
        }
    }

    const selfClosing = children.length === 0;
    const openingElement = t.jsxOpeningElement(jsxName, attrs, selfClosing);
    const closingElement = selfClosing ? null : t.jsxClosingElement(jsxName);

    return t.jsxElement(openingElement, closingElement, children, selfClosing);
}

/** Traverse statements and replace jsx()/jsxs() calls with JSXElement nodes. */
function recoverJSX(statements: t.Statement[]): void {
    const syntheticFile = t.file(t.program(statements, [], "module"));
    traverse(syntheticFile, {
        CallExpression(p) {
            const jsxEl = tryConvertToJSX(p.node);
            if (!jsxEl) return;
            p.replaceWith(jsxEl);
            p.skip();
        },
    });
}

// ---------------------------------------------------------------------------
// Pass G — remove top-level Babel helpers and webpack internals
// ---------------------------------------------------------------------------

function isBabelArrayLikeToArrayHelper(stmt: t.Statement): boolean {
    if (!t.isFunctionDeclaration(stmt) || !stmt.id) return false;
    const body = stmt.body.body;
    if (body.length < 2 || body.length > 4) return false;
    // Key signal: contains `for (var ... = Array(n); ...)` and a return of the array
    const hasArrayOf = body.some(s => {
        if (!t.isForStatement(s)) return false;
        const init = s.init;
        if (!t.isVariableDeclaration(init)) return false;
        return init.declarations.some(
            d => d.init && t.isCallExpression(d.init) && t.isIdentifier((d.init as t.CallExpression).callee, { name: "Array" })
        );
    });
    return hasArrayOf;
}

/** Remove `var x = {}` declarations where every declarator has an empty-object init.
 *  These are webpack module-cache variables. */
function dropEmptyObjectVars(stmts: t.Statement[]): t.Statement[] {
    return stmts.filter(stmt => {
        if (!t.isVariableDeclaration(stmt)) return true;
        return !stmt.declarations.every(
            d => d.init && t.isObjectExpression(d.init) && (d.init as t.ObjectExpression).properties.length === 0
        );
    });
}

// ---------------------------------------------------------------------------
// Pass H — prune unused named imports (e.g. jsx/jsxs after JSX recovery)
// ---------------------------------------------------------------------------

/** Collect all free identifier references in the given statements. */
function collectReferencedNames(stmts: t.Statement[]): Set<string> {
    const names = new Set<string>();
    const syntheticFile = t.file(t.program(stmts, [], "module"));
    traverse(syntheticFile, {
        Identifier(p) {
            // Skip identifier nodes that are property names or binding declarations
            if (p.parentPath?.isImportSpecifier()) return;
            if (p.parentPath?.isImportDefaultSpecifier()) return;
            if (p.parentPath?.isImportNamespaceSpecifier()) return;
            if (p.parentPath?.isMemberExpression() && !(p.parent as t.MemberExpression).computed && p.parentPath.get("property") === p) return;
            if (p.parentPath?.isObjectProperty() && !(p.parent as t.ObjectProperty).computed && p.parentPath.get("key") === p) return;
            if (p.parentPath?.isJSXAttribute()) return;
            if (p.parentPath?.isJSXOpeningElement() || p.parentPath?.isJSXClosingElement()) return;
            names.add(p.node.name);
        },
    });
    return names;
}

/** Remove named import specifiers whose local name is not referenced in `bodyStmts`. */
function pruneUnusedNamedImports(
    importStmts: t.Statement[],
    bodyStmts: t.Statement[]
): t.Statement[] {
    const refs = collectReferencedNames(bodyStmts);
    return importStmts.map(stmt => {
        if (!t.isImportDeclaration(stmt)) return stmt;
        const prunedSpecifiers = stmt.specifiers.filter(spec => {
            if (t.isImportNamespaceSpecifier(spec)) return true; // always keep namespace imports
            if (t.isImportDefaultSpecifier(spec)) return true;
            if (t.isImportSpecifier(spec)) {
                const localName = t.isIdentifier(spec.local) ? spec.local.name : null;
                return localName ? refs.has(localName) : true;
            }
            return true;
        });
        if (prunedSpecifiers.length === 0) return null; // drop empty imports
        if (prunedSpecifiers.length === stmt.specifiers.length) return stmt; // unchanged
        return t.importDeclaration(prunedSpecifiers, stmt.source);
    }).filter(Boolean) as t.Statement[];
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Transforms the non-module-map IIFE statements that become `index.js`.
 *
 * Passes:
 *   A – Remove webpack require helper function.
 *   B – Hoist top-level `var x = requireFn(N)` to static `import * as x from "./N.js"`.
 *   C – Replace remaining inline `requireFn(N)` calls.
 *   D – Rewrite library module calls using identity map (e.g. `l.H(...)` → `createRoot(...)`)
 *       and replace namespace imports with named imports from proper library paths.
 *   E – Collapse Babel slicedToArray expansions to `const [a, b] = expr`.
 *   F – Recover JSX from `jsx(tag, props)` / `jsxs(tag, props)` calls.
 *   G – Remove Babel array-helper functions (e.g. `arrayLikeToArray`).
 */
export const transformIndexStatements = (
    statements: t.Statement[],
    libModuleMap?: Map<string, LibraryModuleInfo>
): t.Statement[] => {
    // Pass A — detect and remove webpack require helper(s).
    const requireFnNames = new Set<string>();
    const afterA: t.Statement[] = [];
    for (const stmt of statements) {
        if (t.isFunctionDeclaration(stmt) && stmt.id && isWebpackRequireHelper(stmt as t.FunctionDeclaration)) {
            requireFnNames.add((stmt.id as t.Identifier).name);
            continue; // drop
        }
        afterA.push(stmt);
    }

    if (requireFnNames.size === 0) return statements; // nothing to do

    const hoistedImports = new Map<string, string>();
    const importNameByNumId = new Map<number, string>();

    // Pass B — hoist top-level `var x = requireFn(N)` to static imports.
    // Also build varName → moduleId so Pass D can look up library identity.
    const varToModuleId = new Map<string, number>(); // localVarName → numericModuleId

    const afterB: t.Statement[] = [];
    for (const stmt of afterA) {
        if (!t.isVariableDeclaration(stmt)) {
            afterB.push(stmt);
            continue;
        }
        const kept: t.VariableDeclarator[] = [];
        for (const decl of stmt.declarations) {
            if (!t.isIdentifier(decl.id) || !decl.init) {
                kept.push(decl);
                continue;
            }
            let matched = false;
            for (const fnName of requireFnNames) {
                const numId = tryExtractRequireCall(decl.init, fnName);
                if (numId === null) continue;
                const spec = `./${numId}.js`;
                const localName = (decl.id as t.Identifier).name;
                if (!hoistedImports.has(spec)) {
                    hoistedImports.set(spec, localName);
                    importNameByNumId.set(numId, localName);
                }
                varToModuleId.set(localName, numId);
                matched = true;
                break;
            }
            if (!matched) kept.push(decl);
        }
        if (kept.length > 0) afterB.push(t.variableDeclaration(stmt.kind, kept));
    }

    // Pass C — replace remaining inline requireFn(N) calls recursively.
    const syntheticFile = t.file(t.program(afterB, [], "module"));
    traverse(syntheticFile, {
        CallExpression(p) {
            for (const fnName of requireFnNames) {
                const numId = tryExtractRequireCall(p.node, fnName);
                if (numId === null) continue;
                let name = importNameByNumId.get(numId);
                if (!name) {
                    name = `_jsr_module_${numId}`;
                    hoistedImports.set(`./${numId}.js`, name);
                    importNameByNumId.set(numId, name);
                }
                p.replaceWith(t.identifier(name));
                p.skip();
                break;
            }
        },
    });

    // Pass D — library-aware import rewriting (only when libModuleMap is supplied).
    // Build varName → LibraryModuleInfo, then rewrite calls and imports.
    const finalImportStmts: t.Statement[] = [];

    if (libModuleMap && libModuleMap.size > 0) {
        // Map local var names to their library identity
        const varToLib = new Map<string, LibraryModuleInfo>();
        for (const [varName, numId] of varToModuleId) {
            const info = libModuleMap.get(String(numId));
            if (info) varToLib.set(varName, info);
        }

        if (varToLib.size > 0) {
            // Rewrite call-sites; collect which named exports are actually used
            const usedExports = rewriteLibraryCalls(afterB, varToLib);

            // Build import declarations for library modules (named imports)
            const handledSpecs = new Set<string>();
            for (const [varName, info] of varToLib) {
                const src = librarySource(info.type);
                if (!src || handledSpecs.has(src)) continue;
                handledSpecs.add(src);
                const used = usedExports.get(src);
                if (used && used.size > 0) {
                    const specifiers = [...used].sort().map(name =>
                        t.importSpecifier(t.identifier(name), t.identifier(name))
                    );
                    finalImportStmts.push(t.importDeclaration(specifiers, t.stringLiteral(src)));
                }
                // Remove the old namespace import for this module
                const numId = varToModuleId.get(varName);
                if (numId !== undefined) hoistedImports.delete(`./${numId}.js`);
            }
        }
    }

    // Remaining (non-library) namespace imports
    for (const [spec, name] of hoistedImports) {
        finalImportStmts.push(
            t.importDeclaration([t.importNamespaceSpecifier(t.identifier(name))], t.stringLiteral(spec))
        );
    }

    // Pass E — collapse Babel slicedToArray expansions.
    const afterE = collapseSlicedToArrayDeep(afterB);

    // Pass F — JSX recovery.
    recoverJSX(afterE);

    // Pass G — remove top-level Babel array-helper functions and webpack module-cache vars.
    const afterG = dropEmptyObjectVars(afterE.filter(stmt => !isBabelArrayLikeToArrayHelper(stmt)));

    // Pass H — prune named imports whose local name is no longer referenced
    //           (e.g. jsx/jsxs after JSX recovery, namespace imports that were cleared).
    const prunedImports = pruneUnusedNamedImports(finalImportStmts, afterG);

    return [...prunedImports, ...afterG];
};
