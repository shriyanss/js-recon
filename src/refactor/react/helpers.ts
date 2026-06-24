import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

export const VALID_IDENT_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

// Returns true if the given ObjectProperty/ObjectMethod sits directly inside
// the webpack module-map object (var X = { <numId>: fn, … }) and not inside
// a nested object within a module body.
export const isInModuleMap = (path: NodePath): boolean => {
    const objectParent = path.parentPath;
    if (!objectParent || !objectParent.isObjectExpression()) return false;
    const objHolder = objectParent.parentPath;
    if (!objHolder) return false;
    // Standard IIFE format: var X = { numId: fn }
    if (objHolder.isVariableDeclarator()) return true;
    if (objHolder.isAssignmentExpression()) return true;
    // Lazy chunk format: (self.webpackChunk...).push([[chunkIds], {numId: fn}])
    // The module-map ObjectExpression is an element of the ArrayExpression argument to .push()
    if (objHolder.isArrayExpression()) {
        const arrayHolder = objHolder.parentPath;
        if (arrayHolder?.isCallExpression()) {
            const callee = (arrayHolder.node as t.CallExpression).callee;
            if (
                t.isMemberExpression(callee) &&
                t.isIdentifier((callee as t.MemberExpression).property, { name: "push" })
            ) {
                return true;
            }
        }
    }
    return false;
};

// Returns { propName, rhs } if expr matches `<exportsParam>.<propName> = <rhs>`.
export const tryExtractExportsAssignment = (
    expr: t.Node,
    exportsParam: string
): { propName: string; rhs: t.Expression } | null => {
    if (!t.isAssignmentExpression(expr) || expr.operator !== "=") return null;
    const left = expr.left;
    if (!t.isMemberExpression(left) || left.computed) return null;
    if (!t.isIdentifier(left.object, { name: exportsParam })) return null;
    let propName: string | null = null;
    if (t.isIdentifier(left.property)) propName = (left.property as t.Identifier).name;
    else if (t.isStringLiteral(left.property)) propName = (left.property as t.StringLiteral).value;
    if (!propName) return null;
    return { propName, rhs: expr.right as t.Expression };
};

// Returns the rhs if expr matches `<moduleParam>.exports = <rhs>`, else null.
export const tryExtractModuleExportsAssignment = (expr: t.Node, moduleParam: string): t.Expression | null => {
    if (!t.isAssignmentExpression(expr) || expr.operator !== "=") return null;
    const left = expr.left;
    if (!t.isMemberExpression(left) || left.computed) return null;
    if (!t.isIdentifier(left.object, { name: moduleParam })) return null;
    if (!t.isIdentifier(left.property, { name: "exports" })) return null;
    return expr.right as t.Expression;
};

// Returns the numeric module ID if expr is `<requireParam>(<NumericLiteral>)`.
export const tryExtractRequireCall = (expr: t.Node, requireParam: string): number | null => {
    if (!t.isCallExpression(expr)) return null;
    if (!t.isIdentifier(expr.callee, { name: requireParam })) return null;
    if (expr.arguments.length !== 1) return null;
    if (!t.isNumericLiteral(expr.arguments[0])) return null;
    return (expr.arguments[0] as t.NumericLiteral).value;
};

// Builds an export statement for `<moduleParam>.exports = <rhs>`.
// - `<requireParam>(N)` RHS → `export * from "./N.js"` (transparent re-export).
// - anything else → `export default <rhs>`.
export const buildModuleExportStatement = (rhs: t.Expression, requireParam: string | undefined): t.Statement => {
    if (requireParam) {
        const numId = tryExtractRequireCall(rhs, requireParam);
        if (numId !== null) {
            return t.exportAllDeclaration(t.stringLiteral(`./${numId}.js`));
        }
    }
    return t.exportDefaultDeclaration(rhs);
};

// Builds an ECMAScript-compliant export statement for `<exportsParam>.<propName> = <rhs>`.
// Forms per MDN export reference:
//   FunctionExpression  → export function propName(params) { body }
//   Identifier          → export { ident as propName } (string key when needed)
//   Literals / Arrow / everything else → export const propName = <rhs>
export const makeNamedExportStatement = (propName: string, rhs: t.Expression): t.Statement => {
    if (t.isFunctionExpression(rhs)) {
        const fn = rhs as t.FunctionExpression;
        return t.exportNamedDeclaration(
            t.functionDeclaration(
                t.identifier(propName),
                fn.params as Array<t.Identifier | t.Pattern | t.RestElement>,
                fn.body,
                fn.generator,
                fn.async
            )
        );
    }
    if (t.isIdentifier(rhs)) {
        const local = rhs as t.Identifier;
        const exported: t.Identifier | t.StringLiteral = VALID_IDENT_RE.test(propName)
            ? t.identifier(propName)
            : t.stringLiteral(propName);
        return t.exportNamedDeclaration(null, [t.exportSpecifier(local, exported)]);
    }
    return t.exportNamedDeclaration(
        t.variableDeclaration("const", [t.variableDeclarator(t.identifier(propName), rhs)])
    );
};
