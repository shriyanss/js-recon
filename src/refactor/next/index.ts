import chalk from "chalk";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { Chunk } from "../../utility/interfaces.js";
import { TurboModuleEntry, WebpackModuleEntry, transformModule, transformWebpackModule } from "./transform.js";
import { validateAndFix } from "./validator.js";

const traverse = _traverse.default;

/**
 * Refactors a single Next.js (Turbopack) chunk into an ECMAScript module file.
 *
 * Supported module formats in a turbopack bundle:
 *
 * 1. Turbopack format: `func_NNN = (module, exports, require) => { ... }`
 *    - module  (params[0]): module object — rarely used
 *    - exports (params[1]): exports target — ODP(exports,"name",{get:fn}) registers named exports;
 *                           turbopack IIFE batch export !(fn)(exports, {name:getter,...}) also handled
 *    - require (params[2]): require function — require(N) imports module N; may be absent for 0/1/2-param modules
 *
 * 2. Webpack-style format: code is the module arrow function directly `(module, exports, require) => {...}`
 *    - Uses require.d(exports, {...}) for export registration
 *    - Uses require.r(exports) as ES module marker (dropped)
 *    - Same param order as turbopack
 *
 * Returns a map { [chunkId]: code } or {} if the chunk cannot be processed.
 */
const refactorNextTurbopack = async (chunk: Chunk): Promise<Record<string, string>> => {
    console.log(chalk.cyan(`[i] Processing Next.js (Turbopack) chunk: ${chunk.id}`));

    const ast = parser.parse(chunk.code, {
        sourceType: "unambiguous",
        plugins: ["jsx", "typescript"],
        errorRecovery: true,
    });

    // Detect format by looking at the code prefix.
    // Turbopack chunks start with `func_NNN = ` (e.g. "func_170 = (e, t, r) => {...}").
    // Webpack-style chunks are just the module function: "(e,t,r)=>{...}" or "e=>{...}".
    const isTurbopackFormat = /^\s*func_\d+\s*=/.test(chunk.code);

    if (isTurbopackFormat) {
        return refactorTurbopackModule(chunk, ast);
    } else {
        return refactorWebpackModule(chunk, ast);
    }
};

/**
 * Handles `func_NNN = (module, exports, require) => { ... }` format.
 * Looks for the top-level assignment and extracts the arrow function params.
 */
async function refactorTurbopackModule(
    chunk: Chunk,
    ast: t.File
): Promise<Record<string, string>> {
    let captured: TurboModuleEntry | null = null;

    traverse(ast, {
        ArrowFunctionExpression(path: NodePath<t.ArrowFunctionExpression>) {
            // Only capture direct assignments: `func_NNN = (e, t, r) => {...}`
            if (!path.parentPath?.isAssignmentExpression() && !path.parentPath?.isVariableDeclarator()) return;

            const params = path.node.params;
            if (params.length > 3) {
                console.log(
                    chalk.yellow(`[!] Module ${chunk.id} has ${params.length} params — skipping`)
                );
                path.stop();
                return;
            }

            // Turbopack: params[0]=runtime (e.r(N)), params[1]=module (t.exports), params[2]=exports (ODP target)
            const runtimeParam = params[0] && t.isIdentifier(params[0]) ? (params[0] as t.Identifier).name : "";
            const moduleParam = params[1] && t.isIdentifier(params[1]) ? (params[1] as t.Identifier).name : "";
            const exportsParam = params[2] && t.isIdentifier(params[2]) ? (params[2] as t.Identifier).name : "";

            captured = {
                id: chunk.id,
                fnPath: path,
                runtimeParam,
                moduleParam,
                exportsParam,
                requireParam: "", // pure turbopack chunks have no webpack-style require
            };
            path.stop();
        },
    });

    if (!captured) {
        console.log(chalk.yellow(`[!] No module function found in chunk ${chunk.id} — skipping`));
        return {};
    }

    const statements = transformModule(captured);
    const code = validateAndFix(statements, chunk.id);
    if (code === null) {
        console.log(chalk.yellow(`[~] Module ${chunk.id} skipped due to unresolvable syntax errors`));
        return {};
    }

    return { [chunk.id]: code };
}

/**
 * Handles webpack-style `(module, exports, require) => { ... }` format.
 * The chunk code IS the module function itself (no func_NNN= prefix).
 */
async function refactorWebpackModule(
    chunk: Chunk,
    ast: t.File
): Promise<Record<string, string>> {
    let captured: WebpackModuleEntry | null = null;

    traverse(ast, {
        ArrowFunctionExpression(path: NodePath<t.ArrowFunctionExpression>) {
            // For webpack-style, the function may be at top level or inside an object property.
            // Accept any top-level arrow function.
            const params = path.node.params;
            if (params.length > 3) return;

            // Skip deeply nested functions — only want the outermost module wrapper.
            if (path.parentPath?.parentPath?.parentPath) return;

            // Webpack-style: params[0]=module, params[1]=exports (t), params[2]=require (r.d/r.r)
            const moduleParam = params[0] && t.isIdentifier(params[0]) ? (params[0] as t.Identifier).name : "";
            const exportsParam = params[1] && t.isIdentifier(params[1]) ? (params[1] as t.Identifier).name : "";
            const requireParam = params[2] && t.isIdentifier(params[2]) ? (params[2] as t.Identifier).name : "";

            if (!captured) {
                captured = {
                    id: chunk.id,
                    fnPath: path,
                    runtimeParam: "", // webpack-style has no turbopack runtime
                    moduleParam,
                    exportsParam,
                    requireParam,
                };
            }
            path.stop();
        },
    });

    if (!captured) {
        console.log(chalk.yellow(`[!] No module function found in webpack chunk ${chunk.id} — skipping`));
        return {};
    }

    const statements = transformWebpackModule(captured);
    const code = validateAndFix(statements, chunk.id);
    if (code === null) {
        console.log(chalk.yellow(`[~] Module ${chunk.id} skipped due to unresolvable syntax errors`));
        return {};
    }

    return { [chunk.id]: code };
}

export default refactorNextTurbopack;
