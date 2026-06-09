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

/**
 * Transforms the non-module-map IIFE statements that become `index.js`.
 *
 * Three passes:
 *   A – Detect and remove the webpack require helper function (matched by its return
 *       statement shape). Record its declared name so Passes B and C can identify calls.
 *   B – Hoist top-level `var x = requireFn(N)` declarators to
 *       `import * as x from "./N.js"`. Records numId → localName for Pass C.
 *   C – Traverse all remaining statements recursively; replace any remaining
 *       `requireFn(N)` CallExpression with the hoisted import identifier
 *       (synthesises `_jsr_module_N` if not yet seen).
 */
export const transformIndexStatements = (statements: t.Statement[]): t.Statement[] => {
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
                if (!hoistedImports.has(spec)) {
                    hoistedImports.set(spec, (decl.id as t.Identifier).name);
                    importNameByNumId.set(numId, (decl.id as t.Identifier).name);
                }
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

    const importStmts: t.Statement[] = [];
    for (const [spec, name] of hoistedImports) {
        importStmts.push(t.importDeclaration([t.importNamespaceSpecifier(t.identifier(name))], t.stringLiteral(spec)));
    }

    return [...importStmts, ...afterB];
};
