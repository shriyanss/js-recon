import * as t from "@babel/types";

export const VALID_IDENT_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

// Returns the numeric module ID if expr is `requireParam(N)` — webpack direct-call require.
// In the webpack module format (NNN:(module,exports,require)=>{...}),
// cross-module requires are direct function calls: require(N).
export const tryExtractWebpackRequire = (expr: t.Node, requireParam: string): number | null => {
    if (!requireParam) return null;
    if (!t.isCallExpression(expr)) return null;
    if (!t.isIdentifier(expr.callee, { name: requireParam })) return null;
    if (expr.arguments.length !== 1) return null;
    const arg = expr.arguments[0];
    if (!t.isNumericLiteral(arg)) return null;
    return (arg as t.NumericLiteral).value;
};

// Extracts the RHS of `moduleParam.exports = X`.
// Returns the RHS expression or null if the statement doesn't match.
export const tryExtractModuleExportsRhs = (stmt: t.Statement, moduleParam: string): t.Expression | null => {
    if (!t.isExpressionStatement(stmt)) return null;
    const expr = stmt.expression;
    if (!t.isAssignmentExpression(expr) || expr.operator !== "=") return null;
    const lhs = expr.left;
    if (!t.isMemberExpression(lhs) || (lhs as t.MemberExpression).computed) return null;
    if (!t.isIdentifier((lhs as t.MemberExpression).object, { name: moduleParam })) return null;
    if (!t.isIdentifier((lhs as t.MemberExpression).property, { name: "exports" })) return null;
    return expr.right as t.Expression;
};

// Returns the numeric module ID if expr is `runtimeParam.r(N)` or `runtimeParam.i(N)`.
// In the turbopack module format (func_NNN = (runtime, module, exports) => {...}),
// cross-module requires are member-expression calls: runtime.r(N) or runtime.i(N).
export const tryExtractTurbopackRequire = (expr: t.Node, runtimeParam: string): number | null => {
    if (!runtimeParam) return null;
    if (!t.isCallExpression(expr)) return null;
    const callee = expr.callee;
    if (!t.isMemberExpression(callee) || (callee as t.MemberExpression).computed) return null;
    if (!t.isIdentifier((callee as t.MemberExpression).object, { name: runtimeParam })) return null;
    const method = (callee as t.MemberExpression).property;
    if (!t.isIdentifier(method)) return null;
    const methodName = (method as t.Identifier).name;
    if (methodName !== "r" && methodName !== "i") return null;
    if (expr.arguments.length !== 1) return null;
    const arg = expr.arguments[0];
    if (!t.isNumericLiteral(arg)) return null;
    return (arg as t.NumericLiteral).value;
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

// Checks whether `stmt` contains `moduleParam.exports = ...` (CJS interop boilerplate).
// Detects the CJS interop boilerplate form: `moduleParam.exports = exportsParam.default`
// (possibly nested deep inside a conditional expression tree).
// Only matches when the RHS is specifically `exportsParam.default` — this avoids false-positives
// on real CJS modules where `e.exports = someLocalVar` is a legitimate export.
export const isInteropBoilerplate = (stmt: t.Statement, moduleParam: string, exportsParam?: string): boolean => {
    if (!t.isExpressionStatement(stmt)) return false;
    return containsModuleExportsDefaultAssignment(stmt.expression, moduleParam, exportsParam ?? "");
};

const containsModuleExportsDefaultAssignment = (node: t.Node, moduleParam: string, exportsParam: string): boolean => {
    if (
        t.isAssignmentExpression(node) &&
        node.operator === "=" &&
        t.isMemberExpression(node.left) &&
        !(node.left as t.MemberExpression).computed &&
        t.isIdentifier((node.left as t.MemberExpression).object, { name: moduleParam }) &&
        t.isIdentifier((node.left as t.MemberExpression).property, { name: "exports" })
    ) {
        // Only strip if the RHS is specifically `exportsParam.default` (interop copy-back).
        // This avoids false-positives on real CJS modules where `e.exports = localVar`.
        const rhs = node.right;
        return (
            t.isMemberExpression(rhs) &&
            !(rhs as t.MemberExpression).computed &&
            t.isIdentifier((rhs as t.MemberExpression).object, { name: exportsParam }) &&
            t.isIdentifier((rhs as t.MemberExpression).property, { name: "default" })
        );
    }
    for (const key of Object.keys(node)) {
        if (key === "type" || key === "loc" || key === "start" || key === "end") continue;
        const child = (node as any)[key];
        if (!child || typeof child !== "object") continue;
        if (Array.isArray(child)) {
            for (const item of child) {
                if (
                    item &&
                    typeof item.type === "string" &&
                    containsModuleExportsDefaultAssignment(item, moduleParam, exportsParam)
                ) {
                    return true;
                }
            }
        } else if (typeof child.type === "string") {
            if (containsModuleExportsDefaultAssignment(child, moduleParam, exportsParam)) return true;
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
export const extractExportsFromMap = (objExpr: t.ObjectExpression): Map<string, t.Expression> => {
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

/**
 * Tries to extract the exports object from a turbopack IIFE batch export:
 *   !(function(target, map) { for(var k in map) ODP(target, k, {enumerable:!0, get:map[k]}) })(exportsParam, {name:fn,...})
 *
 * Also handles the `!` unary prefix that turbopack emits to force the IIFE as an expression.
 * Returns Map<exportName, returnExpr> or null.
 */
export const tryExtractBatchIIFEExports = (expr: t.Node, exportsParam: string): Map<string, t.Expression> | null => {
    // Unwrap unary `!` if present: !(fn)(args) → (fn)(args)
    let callNode: t.Node = expr;
    if (t.isUnaryExpression(callNode) && (callNode as t.UnaryExpression).operator === "!") {
        callNode = (callNode as t.UnaryExpression).argument;
    }
    if (!t.isCallExpression(callNode)) return null;
    const call = callNode as t.CallExpression;

    // callee must be a FunctionExpression with 2 params
    const callee = call.callee;
    if (!t.isFunctionExpression(callee)) return null;
    if ((callee as t.FunctionExpression).params.length !== 2) return null;

    // args[0] must be the exportsParam identifier
    if (call.arguments.length < 2) return null;
    if (!t.isIdentifier(call.arguments[0], { name: exportsParam })) return null;

    // args[1] must be an ObjectExpression (the export map)
    const mapArg = call.arguments[1];
    if (!t.isObjectExpression(mapArg)) return null;

    // Validate the function body: should have a for-in loop that calls ODP
    const fnBody = (callee as t.FunctionExpression).body.body;
    const hasForIn = fnBody.some((s) => {
        if (!t.isForInStatement(s)) return false;
        // body calls Object.defineProperty
        let bodyStmt = s.body;
        if (t.isBlockStatement(bodyStmt)) {
            const nonEmpty = bodyStmt.body.filter((x) => !t.isEmptyStatement(x));
            if (nonEmpty.length !== 1) return false;
            bodyStmt = nonEmpty[0];
        }
        if (!t.isExpressionStatement(bodyStmt)) return false;
        const bodyExpr = bodyStmt.expression;
        if (!t.isCallExpression(bodyExpr)) return false;
        return isObjectDefinePropertyCallee(bodyExpr.callee);
    });

    if (!hasForIn) return null;

    return extractExportsFromMap(mapArg as t.ObjectExpression);
};

// Matches `requireParam.d(exportsParam, { name: () => binding, ... })` — webpack-style export registration.
// Returns Map<exportName, returnExpr> or null.
export const tryExtractRequireDotD = (
    expr: t.Node,
    requireParam: string,
    exportsParam: string
): Map<string, t.Expression> | null => {
    if (!t.isCallExpression(expr)) return null;
    const callee = expr.callee;
    if (!t.isMemberExpression(callee) || (callee as t.MemberExpression).computed) return null;
    if (!t.isIdentifier((callee as t.MemberExpression).object, { name: requireParam })) return null;
    if (!t.isIdentifier((callee as t.MemberExpression).property, { name: "d" })) return null;
    if (expr.arguments.length < 2) return null;
    if (!t.isIdentifier(expr.arguments[0], { name: exportsParam })) return null;
    if (!t.isObjectExpression(expr.arguments[1])) return null;
    return extractExportsFromMap(expr.arguments[1] as t.ObjectExpression);
};

// Returns true if expr is `requireParam.r(exportsParam)` — webpack ESM module marker.
export const isRequireDotR = (expr: t.Node, requireParam: string, exportsParam: string): boolean => {
    if (!t.isCallExpression(expr)) return false;
    const callee = expr.callee;
    if (!t.isMemberExpression(callee) || (callee as t.MemberExpression).computed) return false;
    if (!t.isIdentifier((callee as t.MemberExpression).object, { name: requireParam })) return false;
    if (!t.isIdentifier((callee as t.MemberExpression).property, { name: "r" })) return false;
    if (expr.arguments.length !== 1) return false;
    return t.isIdentifier(expr.arguments[0], { name: exportsParam });
};

/**
 * Matches `runtimeParam.s([exportName, ?, fn])` — turbopack 1-param export registration.
 * Called as: `e.s(["default", 0, function() { return component; }])`
 * Returns { exportName, exportFn } or null.
 */
export const tryExtractRuntimeSExport = (
    expr: t.Node,
    runtimeParam: string
): { exportName: string; exportFn: t.Expression } | null => {
    if (!runtimeParam) return null;
    if (!t.isCallExpression(expr)) return null;
    const callee = expr.callee;
    if (!t.isMemberExpression(callee) || (callee as t.MemberExpression).computed) return null;
    if (!t.isIdentifier((callee as t.MemberExpression).object, { name: runtimeParam })) return null;
    if (!t.isIdentifier((callee as t.MemberExpression).property, { name: "s" })) return null;
    if (expr.arguments.length !== 1 || !t.isArrayExpression(expr.arguments[0])) return null;
    const arr = (expr.arguments[0] as t.ArrayExpression).elements;
    if (arr.length < 3) return null;
    const nameEl = arr[0];
    if (!nameEl || !t.isStringLiteral(nameEl)) return null;
    const exportName = (nameEl as t.StringLiteral).value;
    const fnEl = arr[arr.length - 1];
    if (!fnEl || (!t.isFunctionExpression(fnEl) && !t.isArrowFunctionExpression(fnEl))) return null;
    return { exportName, exportFn: fnEl as t.Expression };
};

// Builds an ECMAScript export statement given an export name and a return expression.
//   Identifier return  → export { ident as exportName }
//   Other expression   → export const exportName = <expr>
// Falls back to string export name when exportName is not a valid identifier.
export const makeExportStatement = (exportName: string, returnExpr: t.Expression): t.Statement => {
    // "default" → export default <expr>
    if (exportName === "default") {
        if (t.isFunctionExpression(returnExpr) || t.isArrowFunctionExpression(returnExpr)) {
            return t.exportDefaultDeclaration(returnExpr);
        }
        return t.exportDefaultDeclaration(returnExpr);
    }

    const isValidIdent = VALID_IDENT_RE.test(exportName);
    if (t.isIdentifier(returnExpr)) {
        const exported: t.Identifier | t.StringLiteral = isValidIdent
            ? t.identifier(exportName)
            : t.stringLiteral(exportName);
        return t.exportNamedDeclaration(null, [t.exportSpecifier(returnExpr as t.Identifier, exported)]);
    }
    if (isValidIdent) {
        return t.exportNamedDeclaration(
            t.variableDeclaration("const", [t.variableDeclarator(t.identifier(exportName), returnExpr)])
        );
    }
    const tempName = `_jsr_exp_${exportName.replace(/[^a-zA-Z0-9_$]/g, "_")}`;
    return t.exportNamedDeclaration(null, [t.exportSpecifier(t.identifier(tempName), t.stringLiteral(exportName))]);
};
