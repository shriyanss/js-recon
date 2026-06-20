import { NodePath } from "@babel/traverse";
import _traverse from "@babel/traverse";
import * as t from "@babel/types";
import {
    tryExtractTurbopackRequire,
    tryExtractDefinePropertyExport,
    isEsModuleMarker,
    isInteropBoilerplate,
    tryExtractForInExportLoop,
    extractExportsFromMap,
    makeExportStatement,
} from "./helpers.js";

const traverse = _traverse.default;

export type TurboModuleEntry = {
    id: string;
    fnPath: NodePath<t.ArrowFunctionExpression>;
    runtimeParam: string; // first param — has .r() for cross-module requires
    moduleParam: string; // second param — t.exports interop
    exportsParam: string; // third param — Object.defineProperty target
};

/**
 * Transforms a single Turbopack module arrow function into ECMAScript module statements.
 *
 * Passes (top-level only to avoid placing exports inside nested functions):
 *   1. Collect exports from Object.defineProperty(exportsParam, …) patterns + mark nodes for removal.
 *   2. Combined filter + hoist: skip removed nodes; convert runtimeParam.r(N) declarators to imports.
 *   3. Replace remaining inline runtimeParam.r(N) calls with hoisted identifiers.
 *   4. Assemble: prepend import declarations, keep filtered body, append export declarations.
 */
export const transformModule = (mod: TurboModuleEntry): t.Statement[] => {
    const { fnPath, runtimeParam, moduleParam, exportsParam } = mod;
    const body = fnPath.node.body;
    if (!t.isBlockStatement(body)) return [];

    // ── Pre-scan: find for-in export loops and their map variable declarations ──
    // Map from variable name → the VariableDeclaration node that declares it as an export map.
    // We also track the specific declarator so we can remove just that one if needed.
    const exportMapVarNames = new Set<string>();
    const exportMapDeclNodes = new Map<string, t.VariableDeclaration>(); // varName → decl node

    for (const stmt of body.body) {
        const mapVarName = tryExtractForInExportLoop(stmt, exportsParam);
        if (mapVarName !== null) {
            exportMapVarNames.add(mapVarName);
        }
    }
    for (const stmt of body.body) {
        if (!t.isVariableDeclaration(stmt)) continue;
        for (const decl of stmt.declarations) {
            if (
                t.isIdentifier(decl.id) &&
                exportMapVarNames.has((decl.id as t.Identifier).name) &&
                decl.init &&
                t.isObjectExpression(decl.init)
            ) {
                exportMapDeclNodes.set((decl.id as t.Identifier).name, stmt);
            }
        }
    }

    // ── Pass 1: collect exports, mark statement nodes for removal ────────────────
    const exportMap = new Map<string, t.Expression>(); // exportName → returnExpr
    const stmtsToRemove = new WeakSet<t.Statement>();

    for (const stmt of body.body) {
        // Interop boilerplate.
        if (isInteropBoilerplate(stmt, moduleParam)) {
            stmtsToRemove.add(stmt);
            continue;
        }

        if (t.isExpressionStatement(stmt)) {
            const expr = stmt.expression;

            // `Object.defineProperty(r, "__esModule", …)` — just an interop marker.
            if (isEsModuleMarker(expr, exportsParam)) {
                stmtsToRemove.add(stmt);
                continue;
            }

            // Direct `Object.defineProperty(r, "name", { get: fn })`.
            const direct = tryExtractDefinePropertyExport(expr, exportsParam);
            if (direct) {
                exportMap.set(direct.exportName, direct.returnExpr);
                stmtsToRemove.add(stmt);
                continue;
            }

            // SequenceExpression: may mix esModule markers and export definitions.
            if (t.isSequenceExpression(expr)) {
                const kept: t.Expression[] = [];
                for (const sub of expr.expressions) {
                    if (isEsModuleMarker(sub, exportsParam)) continue;
                    const match = tryExtractDefinePropertyExport(sub, exportsParam);
                    if (match) {
                        exportMap.set(match.exportName, match.returnExpr);
                    } else {
                        kept.push(sub);
                    }
                }
                if (kept.length === 0) {
                    stmtsToRemove.add(stmt);
                } else if (kept.length < expr.expressions.length) {
                    // Trim the sequence in-place.
                    (stmt as t.ExpressionStatement).expression =
                        kept.length === 1 ? kept[0] : t.sequenceExpression(kept);
                }
                continue;
            }
        }

        // ForInStatement: `for (var k in mapVar) Object.defineProperty(exportsParam, k, …)`.
        const mapVarName = tryExtractForInExportLoop(stmt, exportsParam);
        if (mapVarName !== null) {
            stmtsToRemove.add(stmt);
            const declNode = exportMapDeclNodes.get(mapVarName);
            if (declNode) {
                // Extract exports from the map object.
                for (const decl of declNode.declarations) {
                    if (t.isIdentifier(decl.id, { name: mapVarName }) && decl.init && t.isObjectExpression(decl.init)) {
                        const extracted = extractExportsFromMap(decl.init as t.ObjectExpression);
                        for (const [name, expr] of extracted) exportMap.set(name, expr);
                        break;
                    }
                }
                // Mark the map variable declaration for removal.
                if (declNode.declarations.length === 1) {
                    stmtsToRemove.add(declNode);
                } else {
                    // Multiple declarators: remove only the export-map one.
                    (declNode as any).declarations = declNode.declarations.filter(
                        (d) => !t.isIdentifier(d.id, { name: mapVarName })
                    );
                }
            }
        }
    }

    // ── Pass 2: combined filter + require hoisting ───────────────────────────────
    const hoistedImports = new Map<string, string>(); // specifier → importName
    const importNameByNumId = new Map<number, string>(); // numId → importName

    const filteredBody: t.Statement[] = [];
    for (const stmt of body.body) {
        if (stmtsToRemove.has(stmt)) continue;

        if (t.isVariableDeclaration(stmt)) {
            const keptDeclarators: t.VariableDeclarator[] = [];
            for (const decl of stmt.declarations) {
                if (!t.isIdentifier(decl.id) || !decl.init) {
                    keptDeclarators.push(decl);
                    continue;
                }
                const numId = tryExtractTurbopackRequire(decl.init, runtimeParam);
                if (numId === null) {
                    keptDeclarators.push(decl);
                    continue;
                }
                const spec = `./${numId}.js`;
                if (!hoistedImports.has(spec)) {
                    hoistedImports.set(spec, (decl.id as t.Identifier).name);
                    importNameByNumId.set(numId, (decl.id as t.Identifier).name);
                }
                // Declarator removed — becomes a static import.
            }
            if (keptDeclarators.length > 0) {
                filteredBody.push(t.variableDeclaration(stmt.kind, keptDeclarators));
            }
            continue;
        }

        filteredBody.push(stmt);
    }

    // ── Pass 3: replace remaining inline runtimeParam.r(N) calls ────────────────
    body.body = filteredBody;
    fnPath.traverse({
        CallExpression(p) {
            const numId = tryExtractTurbopackRequire(p.node, runtimeParam);
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

    // ── Step 4: assemble — prepend imports, filtered body, append exports ────────
    const importStmts: t.Statement[] = [];
    for (const [spec, name] of hoistedImports) {
        importStmts.push(t.importDeclaration([t.importNamespaceSpecifier(t.identifier(name))], t.stringLiteral(spec)));
    }

    const exportStmts: t.Statement[] = [];
    for (const [exportName, returnExpr] of exportMap) {
        exportStmts.push(makeExportStatement(exportName, returnExpr));
    }

    return [...importStmts, ...body.body, ...exportStmts];
};
