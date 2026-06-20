import chalk from "chalk";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { Chunk } from "../../utility/interfaces.js";
import { TurboModuleEntry, transformModule } from "./transform.js";
import { validateAndFix } from "./validator.js";

const traverse = _traverse.default;

/**
 * Refactors a single Next.js (Turbopack) module into an ECMAScript module file.
 *
 * The `map` step extracts each Turbopack module as:
 *   func_<id> = (e, t, r) => { … }
 *
 * Parameters of the module arrow function:
 *   e — runtime/module object (cross-module require: e.r(N))
 *   t — module object (t.exports used in interop)
 *   r — exports object (Object.defineProperty(r, "name", …) sets named exports)
 *
 * Returns a map containing the single transformed module: { [chunk.id]: code }.
 */
const refactorNext = async (chunk: Chunk): Promise<Record<string, string>> => {
    console.log(chalk.cyan(`[i] Processing Next.js chunk: ${chunk.id}`));

    const ast = parser.parse(chunk.code, {
        sourceType: "unambiguous",
        plugins: ["jsx", "typescript"],
        errorRecovery: true,
    });

    let captured: TurboModuleEntry | null = null;

    traverse(ast, {
        ArrowFunctionExpression(path: NodePath<t.ArrowFunctionExpression>) {
            // Only process top-level arrow functions (direct assignment like `func_511 = (e,t,r) => {...}`).
            if (!path.parentPath?.isAssignmentExpression() && !path.parentPath?.isVariableDeclarator()) return;

            const params = path.node.params;
            if (params.length > 3) {
                console.log(
                    chalk.yellow(`[!] Module ${chunk.id} has ${params.length} params — not yet researched, skipping`)
                );
                path.stop();
                return;
            }

            const runtimeParam = params[0] && t.isIdentifier(params[0]) ? (params[0] as t.Identifier).name : "";
            const moduleParam = params[1] && t.isIdentifier(params[1]) ? (params[1] as t.Identifier).name : "";
            const exportsParam = params[2] && t.isIdentifier(params[2]) ? (params[2] as t.Identifier).name : "";

            captured = {
                id: chunk.id,
                fnPath: path,
                runtimeParam,
                moduleParam,
                exportsParam,
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
};

export default refactorNext;
