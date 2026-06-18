import * as t from "@babel/types";
import { ModuleEntry } from "./transform.js";

export type LibraryType = "react" | "react-dom-client" | "react-jsx-runtime" | "unknown";

export interface LibraryModuleInfo {
    type: LibraryType;
    /** Minified export prop → canonical name. e.g. "H" → "createRoot" */
    exportMap: Map<string, string>;
}

export const REACT_CANONICAL = new Set([
    "useState", "useEffect", "useRef", "useMemo", "useCallback", "useContext",
    "useReducer", "useLayoutEffect", "useDebugValue", "useId", "useTransition",
    "useDeferredValue", "useInsertionEffect", "useImperativeHandle", "useSyncExternalStore",
    "createElement", "Fragment", "Component", "PureComponent", "createContext",
    "forwardRef", "memo", "Profiler", "Suspense", "StrictMode", "createRef", "isValidElement",
    "Children", "cloneElement", "startTransition", "lazy", "version", "createPortal",
    "flushSync", "act", "cache",
]);

// Deliberately excludes "Fragment" — React itself also exports Fragment, so it is not
// a distinctive marker for classification. Use only jsx/jsxs/jsxDEV which are unique to
// this package. For rewriting purposes, Fragment is handled in resolveLibraryProp.
export const JSX_RUNTIME_CANONICAL = new Set(["jsx", "jsxs", "jsxDEV"]);
export const REACT_DOM_CLIENT_CANONICAL = new Set(["createRoot", "hydrateRoot"]);

const LIBRARY_SOURCE: Record<LibraryType, string> = {
    "react": "react",
    "react-dom-client": "react-dom/client",
    "react-jsx-runtime": "react/jsx-runtime",
    "unknown": "",
};

export const librarySource = (type: LibraryType): string => LIBRARY_SOURCE[type];

function scanExportMap(mod: ModuleEntry): Map<string, string> {
    const map = new Map<string, string>();
    const { exportsParam } = mod;
    if (!exportsParam) return map;
    const body = (mod.fnPath.node as { body?: t.Node }).body;
    if (!body || !t.isBlockStatement(body)) return map;

    for (const stmt of body.body) {
        if (!t.isExpressionStatement(stmt)) continue;
        const exprs = t.isSequenceExpression(stmt.expression)
            ? stmt.expression.expressions
            : [stmt.expression];
        for (const ex of exprs) {
            if (!t.isAssignmentExpression(ex) || ex.operator !== "=") continue;
            const lhs = ex.left;
            if (!t.isMemberExpression(lhs) || lhs.computed) continue;
            if (!t.isIdentifier(lhs.object, { name: exportsParam })) continue;
            const minName = t.isIdentifier(lhs.property) ? lhs.property.name : null;
            if (!minName) continue;
            const rhs = ex.right;
            if (t.isMemberExpression(rhs) && !rhs.computed && t.isIdentifier(rhs.property)) {
                map.set(minName, (rhs.property as t.Identifier).name);
            } else if (t.isIdentifier(rhs)) {
                map.set(minName, (rhs as t.Identifier).name);
            } else {
                // RHS is a complex expression (e.g. function declaration) — record the key
                // with a self-reference so it participates in canonical classification checks.
                map.set(minName, minName);
            }
        }
    }
    return map;
}

export function classifyLibraryModule(mod: ModuleEntry): LibraryModuleInfo {
    const exportMap = scanExportMap(mod);
    // Check both keys (prop names as exported, e.g. "jsx") AND values (canonical from RHS, e.g. "createRoot").
    // Keys cover modules that export with canonical names directly (React, jsx-runtime).
    // Values cover shim modules that rename (e.g. react-dom/client: H → createRoot).
    const keys = [...exportMap.keys()];
    const vals = [...exportMap.values()];
    if (keys.some(k => REACT_DOM_CLIENT_CANONICAL.has(k)) || vals.some(v => REACT_DOM_CLIENT_CANONICAL.has(v)))
        return { type: "react-dom-client", exportMap };
    if (keys.some(k => JSX_RUNTIME_CANONICAL.has(k)) || vals.some(v => JSX_RUNTIME_CANONICAL.has(v)))
        return { type: "react-jsx-runtime", exportMap };
    if (keys.some(k => REACT_CANONICAL.has(k)) || vals.some(v => REACT_CANONICAL.has(v)))
        return { type: "react", exportMap };
    return { type: "unknown", exportMap };
}

/**
 * Returns the numeric module ID that this module transparently re-exports
 * (i.e. its entire body is `moduleParam.exports = requireParam(N)`), or null.
 */
export function getReexportTarget(mod: ModuleEntry): number | null {
    const body = (mod.fnPath.node as { body?: t.Node }).body;
    if (!body || !t.isBlockStatement(body)) return null;
    const stmts = (body as t.BlockStatement).body;
    if (stmts.length !== 1) return null;
    const stmt = stmts[0];
    if (!t.isExpressionStatement(stmt)) return null;
    const expr = stmt.expression;
    if (!t.isAssignmentExpression(expr) || expr.operator !== "=") return null;
    const lhs = expr.left;
    if (!t.isMemberExpression(lhs) || lhs.computed) return null;
    if (!t.isIdentifier(lhs.object, { name: mod.moduleParam })) return null;
    if (!t.isIdentifier(lhs.property, { name: "exports" })) return null;
    if (!mod.requireParam) return null;
    const rhs = expr.right;
    if (!t.isCallExpression(rhs)) return null;
    if (!t.isIdentifier(rhs.callee, { name: mod.requireParam })) return null;
    if (rhs.arguments.length !== 1 || !t.isNumericLiteral(rhs.arguments[0])) return null;
    return (rhs.arguments[0] as t.NumericLiteral).value;
}

/**
 * Resolves transparent re-export chains in a module map.
 * E.g. 540 → 287 (React): if 287 is classified as 'react', 540 also becomes 'react'.
 * Runs up to 5 passes to handle chains of length > 1.
 */
export function resolveReexportChains(
    libModuleMap: Map<string, LibraryModuleInfo>,
    modules: ModuleEntry[]
): void {
    for (let pass = 0; pass < 5; pass++) {
        let changed = false;
        for (const mod of modules) {
            const info = libModuleMap.get(mod.id);
            if (!info || info.type !== "unknown") continue;
            const targetId = getReexportTarget(mod);
            if (targetId === null) continue;
            const targetInfo = libModuleMap.get(String(targetId));
            if (targetInfo && targetInfo.type !== "unknown") {
                libModuleMap.set(mod.id, { type: targetInfo.type, exportMap: targetInfo.exportMap });
                changed = true;
            }
        }
        if (!changed) break;
    }
}
