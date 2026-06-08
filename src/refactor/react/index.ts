// ECMAScript export reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export
// ECMAScript import reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import

import chalk from "chalk";
import parser from "@babel/parser";
import _traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { Chunk } from "../../utility/interfaces.js";
import { isInModuleMap } from "./helpers.js";
import { validateAndFix } from "./validator.js";
import { ModuleEntry, transformModule } from "./transform.js";

const traverse = _traverse.default;

/**
 * Rewrites a webpack-bundled React chunk by splitting the numeric module map
 * into individual ECMAScript module files.
 *
 *   Step 1 – Find the `var X = { <numId>: function(e,n,t){…}, … }` module map.
 *   Step 2 – For each module:
 *              a) Convert `<moduleParam>.exports = <requireParam>(N)` → `export * from "./N.js"`
 *                 (and `<moduleParam>.exports = <expr>` → `export default <expr>`),
 *                 including inside top-level sequence expressions.
 *              b) Convert `<exportsParam>.<propName> = <rhs>` → ECMAScript named exports
 *                 (per MDN export reference) for any module that has an exports param.
 *              c) Hoist `var <name> = <requireParam>(N)` to `import * as <name> from "./N.js"`.
 *              d) Replace remaining inline `<requireParam>(N)` calls with a synthesized
 *                 namespace import reference.
 *              e) Strip the outer function wrapper.
 *   Step 3 – Validate generated code with Babel; iteratively drop/downgrade statements
 *              that still cause parse errors.
 */
const refactorReact = async (chunk: Chunk): Promise<Record<string, string>> => {
    console.log(chalk.cyan(`[i] Processing React bundle: ${chunk.id}`));

    const ast = parser.parse(chunk.code, {
        sourceType: "unambiguous",
        plugins: ["jsx", "typescript"],
        errorRecovery: true,
    });

    const modules: ModuleEntry[] = [];

    const captureProperty = (path: NodePath<t.ObjectProperty>) => {
        if (!isInModuleMap(path)) return;
        const key = path.node.key;
        if (!t.isNumericLiteral(key)) {
            if (t.isStringLiteral(key) && /[a-zA-Z]/.test(key.value)) {
                console.log(
                    chalk.yellow(
                        `[!] Alphanumeric module ID "${key.value}" detected — not yet supported, skipping (please open a PR)`
                    )
                );
            }
            return;
        }
        const value = path.node.value;
        if (!t.isFunctionExpression(value) && !t.isArrowFunctionExpression(value)) return;
        const id = String(key.value);
        const params = value.params;
        if (params.length > 3) {
            console.log(
                chalk.yellow(
                    `[!] Module ${id} has ${params.length} params — not yet researched, skipping`
                )
            );
            return;
        }
        const moduleParam = params[0] && t.isIdentifier(params[0]) ? (params[0] as t.Identifier).name : "";
        const exportsParam = params[1] && t.isIdentifier(params[1]) ? (params[1] as t.Identifier).name : "";
        const requireParam =
            params.length >= 3 && t.isIdentifier(params[2])
                ? (params[2] as t.Identifier).name
                : undefined;
        modules.push({
            id,
            fnPath: path.get("value") as NodePath<t.FunctionExpression | t.ArrowFunctionExpression>,
            paramCount: params.length,
            moduleParam,
            exportsParam,
            requireParam,
        });
    };

    const captureMethod = (path: NodePath<t.ObjectMethod>) => {
        if (!isInModuleMap(path)) return;
        const key = path.node.key;
        if (!t.isNumericLiteral(key)) {
            if (t.isStringLiteral(key) && /[a-zA-Z]/.test(key.value)) {
                console.log(
                    chalk.yellow(
                        `[!] Alphanumeric module ID "${key.value}" detected — not yet supported, skipping (please open a PR)`
                    )
                );
            }
            return;
        }
        const id = String(key.value);
        const params = path.node.params;
        if (params.length > 3) {
            console.log(
                chalk.yellow(
                    `[!] Module ${id} has ${params.length} params — not yet researched, skipping`
                )
            );
            return;
        }
        const moduleParam = params[0] && t.isIdentifier(params[0]) ? (params[0] as t.Identifier).name : "";
        const exportsParam = params[1] && t.isIdentifier(params[1]) ? (params[1] as t.Identifier).name : "";
        const requireParam =
            params.length >= 3 && t.isIdentifier(params[2])
                ? (params[2] as t.Identifier).name
                : undefined;
        modules.push({
            id,
            fnPath: path as unknown as NodePath<t.ObjectMethod>,
            paramCount: params.length,
            moduleParam,
            exportsParam,
            requireParam,
        });
    };

    traverse(ast, {
        ObjectProperty: captureProperty,
        ObjectMethod: captureMethod,
    });

    console.log(chalk.cyan(`[i] Found ${modules.length} modules`));

    const results: Record<string, string> = {};

    for (const mod of modules) {
        const statements = transformModule(mod);
        const code = validateAndFix(statements, mod.id);
        if (code === null) {
            console.log(chalk.yellow(`[~] Module ${mod.id} skipped due to unresolvable syntax errors`));
            continue;
        }
        results[mod.id] = code;
    }

    return results;
};

export default refactorReact;
