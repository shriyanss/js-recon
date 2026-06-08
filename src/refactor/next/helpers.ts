import * as t from "@babel/types";

export const VALID_IDENT_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

// Returns the numeric module ID if expr is `runtimeParam.r(<NumericLiteral>)`.
export const tryExtractTurbopackRequire = (expr: t.Node, runtimeParam: string): number | null => {
    if (!t.isCallExpression(expr)) return null;
    const callee = expr.callee;
    if (!t.isMemberExpression(callee) || callee.computed) return null;
    if (!t.isIdentifier(callee.object, { name: runtimeParam })) return null;
    if (!t.isIdentifier(callee.property, { name: "r" })) return null;
    if (expr.arguments.length !== 1) return null;
    if (!t.isNumericLiteral(expr.arguments[0])) return null;
    return (expr.arguments[0] as t.NumericLiteral).value;
};

// Returns true if expr is `Object.defineProperty(target, "__esModule", ...)`.
export const isEsModuleMarker = (expr: t.Node, exportsParam: string): boolean => {
    if (!t.isCallExpression(expr)) return false;
    if (!isObjectDefinePropertyCallee(expr.callee)) return false;
    if (expr.arguments.length < 2) return false;
    if (!t.isIdentifier(expr.arguments[0], { name: exportsParam })) return false;
    const nameArg = expr.arguments[1];
    return t.isStringLiteral(nameArg) && (nameArg as t.StringLiteral).value === "__esModule";
};

// Returns true if expr.callee is `Object.defineProperty`.
const isObjectDefinePropertyCallee = (callee: t.Node): boolean => {
    if (!t.isMemberExpression(callee) || (callee as t.MemberExpression).computed) return false;
    return (
        t.isIdentifier((callee as t.MemberExpression).object, { name: "Object" }) &&
        t.isIdentifier((callee as t.MemberExpression).property, { name: "defineProperty" })
    );
};

// Extracts the return expression from a getter function:
//   function() { return X; }  or  () => X  or  () => { return X; }
export const extractGetterReturnExpr = (getterFn: t.Expression): t.Expression | null => {
    if (t.isFunctionExpression(getterFn) || t.isFunctionDeclaration(getterFn)) {
        const body = getterFn.body;
        if (!t.isBlockStatement(body)) return null;
        const stmts = body.body.filter((s) => !t.isEmptyStatement(s));
        if (stmts.length !== 1 || !t.isReturnStatement(stmts[0])) return null;
        return (stmts[0] as t.ReturnStatement).argument ?? null;
    }
    if (t.isArrowFunctionExpression(getterFn)) {
        if (!t.isBlockStatement(getterFn.body)) return getterFn.body as t.Expression;
        const stmts = getterFn.body.body.filter((s) => !t.isEmptyStatement(s));
        if (stmts.length !== 1 || !t.isReturnStatement(stmts[0])) return null;
        return (stmts[0] as t.ReturnStatement).argument ?? null;
    }
    return null;
};

// Matches `Object.defineProperty(exportsParam, "name", { ..., get: fn })`.
// Returns { exportName, returnExpr } or null.  Skips "__esModule".
export const tryExtractDefinePropertyExport = (
    expr: t.Node,
    exportsParam: string
): { exportName: string; returnExpr: t.Expression } | null => {
    if (!t.isCallExpression(expr)) return null;
    if (!isObjectDefinePropertyCallee(expr.callee)) return null;
    if (expr.arguments.length < 3) return null;
    if (!t.isIdentifier(expr.arguments[0], { name: exportsParam })) return null;
    const nameArg = expr.arguments[1];
    if (!t.isStringLiteral(nameArg)) return null;
    const exportName = (nameArg as t.StringLiteral).value;
    if (exportName === "__esModule") return null;

    const descriptor = expr.arguments[2];
    if (!t.isObjectExpression(descriptor)) return null;

    for (const prop of (descriptor as t.ObjectExpression).properties) {
        if (!t.isObjectProperty(prop) || (prop as t.ObjectProperty).computed) continue;
        const key = (prop as t.ObjectProperty).key;
        if (!t.isIdentifier(key, { name: "get" })) continue;
        const getterFn = (prop as t.ObjectProperty).value as t.Expression;
        const returnExpr = extractGetterReturnExpr(getterFn);
        if (returnExpr === null) continue;
        return { exportName, returnExpr };
    }
    return null;
};

// Checks whether `stmt` is the Turbopack interop boilerplate that ends in `moduleParam.exports = exportsParam.default`.
// Heuristic: ExpressionStatement whose expression (recursively) contains an assignment to `moduleParam.exports`.
export const isInteropBoilerplate = (stmt: t.Statement, moduleParam: string): boolean => {
    if (!t.isExpressionStatement(stmt)) return false;
    return containsModuleExportsAssignment(stmt.expression, moduleParam);
};

const containsModuleExportsAssignment = (node: t.Node, moduleParam: string): boolean => {
    if (
        t.isAssignmentExpression(node) &&
        node.operator === "=" &&
        t.isMemberExpression(node.left) &&
        !(node.left as t.MemberExpression).computed &&
        t.isIdentifier((node.left as t.MemberExpression).object, { name: moduleParam }) &&
        t.isIdentifier((node.left as t.MemberExpression).property, { name: "exports" })
    ) {
        return true;
    }
    for (const key of Object.keys(node)) {
        if (key === "type" || key === "loc" || key === "start" || key === "end") continue;
        const child = (node as any)[key];
        if (!child || typeof child !== "object") continue;
        if (Array.isArray(child)) {
            for (const item of child) {
                if (item && typeof item.type === "string" && containsModuleExportsAssignment(item, moduleParam)) {
                    return true;
                }
            }
        } else if (typeof child.type === "string") {
            if (containsModuleExportsAssignment(child, moduleParam)) return true;
        }
    }
    return false;
};

// Matches `for (var k in mapVarName) Object.defineProperty(exportsParam, k, ...)`.
// Returns the mapVarName or null.
export const tryExtractForInExportLoop = (stmt: t.Statement, exportsParam: string): string | null => {
    if (!t.isForInStatement(stmt)) return null;

    // right must be a simple identifier (the map variable)
    if (!t.isIdentifier(stmt.right)) return null;
    const mapVarName = (stmt.right as t.Identifier).name;

    // body: unwrap block if needed
    let bodyStmt = stmt.body;
    if (t.isBlockStatement(bodyStmt)) {
        const nonEmpty = bodyStmt.body.filter((s) => !t.isEmptyStatement(s));
        if (nonEmpty.length !== 1) return null;
        bodyStmt = nonEmpty[0];
    }
    if (!t.isExpressionStatement(bodyStmt)) return null;

    const expr = bodyStmt.expression;
    if (!t.isCallExpression(expr)) return null;
    if (!isObjectDefinePropertyCallee(expr.callee)) return null;
    if (expr.arguments.length < 1) return null;
    if (!t.isIdentifier(expr.arguments[0], { name: exportsParam })) return null;

    return mapVarName;
};

// Extracts all { exportName → returnExpr } entries from an export map object literal.
// The map has shape: { name: function() { return localVar; }, … }
export const extractExportsFromMap = (
    objExpr: t.ObjectExpression
): Map<string, t.Expression> => {
    const result = new Map<string, t.Expression>();
    for (const prop of objExpr.properties) {
        if (!t.isObjectProperty(prop) && !t.isObjectMethod(prop)) continue;
        const keyNode = (prop as t.ObjectProperty | t.ObjectMethod).key;
        let exportName: string | null = null;
        if (t.isIdentifier(keyNode)) exportName = (keyNode as t.Identifier).name;
        else if (t.isStringLiteral(keyNode)) exportName = (keyNode as t.StringLiteral).value;
        if (!exportName || exportName === "__esModule") continue;

        let returnExpr: t.Expression | null = null;
        if (t.isObjectProperty(prop)) {
            returnExpr = extractGetterReturnExpr((prop as t.ObjectProperty).value as t.Expression);
        } else if (t.isObjectMethod(prop)) {
            const m = prop as t.ObjectMethod;
            const stmts = m.body.body.filter((s) => !t.isEmptyStatement(s));
            if (stmts.length === 1 && t.isReturnStatement(stmts[0])) {
                returnExpr = (stmts[0] as t.ReturnStatement).argument ?? null;
            }
        }
        if (returnExpr !== null) result.set(exportName, returnExpr);
    }
    return result;
};

// Builds an ECMAScript export statement given an export name and a return expression.
//   Identifier return  → export { ident as exportName }
//   Other expression   → export const exportName = <expr>
// Falls back to string export name when exportName is not a valid identifier.
export const makeExportStatement = (exportName: string, returnExpr: t.Expression): t.Statement => {
    const isValidIdent = VALID_IDENT_RE.test(exportName);
    if (t.isIdentifier(returnExpr)) {
        const exported: t.Identifier | t.StringLiteral = isValidIdent
            ? t.identifier(exportName)
            : t.stringLiteral(exportName);
        return t.exportNamedDeclaration(null, [
            t.exportSpecifier(returnExpr as t.Identifier, exported),
        ]);
    }
    if (isValidIdent) {
        return t.exportNamedDeclaration(
            t.variableDeclaration("const", [t.variableDeclarator(t.identifier(exportName), returnExpr)])
        );
    }
    // Non-identifier name with a non-identifier value: introduce a temp binding.
    const tempName = `_jsr_exp_${exportName.replace(/[^a-zA-Z0-9_$]/g, "_")}`;
    return t.exportNamedDeclaration(null, [
        t.exportSpecifier(t.identifier(tempName), t.stringLiteral(exportName)),
    ]);
};
