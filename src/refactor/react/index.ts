// ECMAScript export reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export
// ECMAScript import reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import

import chalk from "chalk";
import parser from "@babel/parser";
import _traverse, { NodePath } from "@babel/traverse";
import _generator from "@babel/generator";
import * as t from "@babel/types";
import { cs_mast_init, ScatCategory } from "@shriyanss/cs-mast";
import { Chunk } from "../../utility/interfaces.js";
import { isInModuleMap } from "./helpers.js";
import { validateAndFix } from "./validator.js";
import { ModuleEntry, transformModule, transformIndexStatements } from "./transform.js";
import { LibraryModuleInfo, classifyLibraryModule, resolveReexportChains } from "./library-classify.js";

const traverse = _traverse.default;
const generate = (_generator as unknown as { default: typeof _generator }).default ?? _generator;

// scat config used when computing experiment-baseline signatures (matches
// refactor_observations/feature-signatures/<feature>/lit-decl-loop-cond/collisions.json).
const LIB_SIG_SCAT: ScatCategory[] = ["lit", "decl", "loop", "cond"];

// Returns the body statements of a top-level IIFE (e.g. `(() => { … })()`), or null.
const findIifeBody = (program: t.Program): t.Statement[] | null => {
    for (const stmt of program.body) {
        if (!t.isExpressionStatement(stmt)) continue;
        const expr = stmt.expression;
        if (!t.isCallExpression(expr) || expr.arguments.length !== 0) continue;
        const callee = expr.callee;
        if (
            (t.isArrowFunctionExpression(callee) || t.isFunctionExpression(callee)) &&
            t.isBlockStatement(callee.body)
        ) {
            return callee.body.body;
        }
    }
    return null;
};

// Returns true when a VariableDeclarator's init is the webpack numeric module map
// object (every property has a NumericLiteral key and a function value).
const isModuleMapDeclarator = (d: t.VariableDeclarator): boolean => {
    if (!t.isObjectExpression(d.init)) return false;
    const props = (d.init as t.ObjectExpression).properties;
    if (props.length === 0) return false;
    return props.every((p) => {
        if (t.isObjectProperty(p))
            return (
                t.isNumericLiteral(p.key) && (t.isFunctionExpression(p.value) || t.isArrowFunctionExpression(p.value))
            );
        if (t.isObjectMethod(p)) return t.isNumericLiteral(p.key);
        return false;
    });
};

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
 *   Step 4 – Collect all IIFE body statements that are NOT part of the module map and
 *              write them to `index.js` (entrypoint bootstrap, app component functions,
 *              the ReactDOM.render call, etc.).
 */
const isLibrarySig = (sig: string | undefined, libSigs: Set<string> | undefined): boolean =>
    !!(sig && libSigs && libSigs.has(sig));

// Hash a single module's function body using cs_mast_init and look the signature
// up against the count=18 baseline set. Returns true when the module's body
// matches a baseline library signature.
const moduleIsLibrary = (
    mod: ModuleEntry,
    libSigs: Set<string> | undefined
): boolean => {
    if (!libSigs || libSigs.size === 0) return false;
    const fnNode = mod.fnPath.node as t.FunctionExpression | t.ArrowFunctionExpression | t.ObjectMethod;
    if (!t.isBlockStatement((fnNode as { body?: t.Node }).body)) return false;
    const body = (fnNode as { body: t.BlockStatement }).body;
    try {
        const code = generate(body).code;
        const tree = cs_mast_init(code, {
            hash: "sha256",
            scat: LIB_SIG_SCAT,
            sinc: [],
            lang: "js",
            prsr: "@babel/parser",
        });
        for (const sig of tree._signatureMap.keys()) {
            if (isLibrarySig(sig, libSigs)) return true;
        }
    } catch {
        // unparseable / unhashable — fall through and treat as non-library
    }
    return false;
};

const refactorReact = async (chunk: Chunk, libSigs?: Set<string>): Promise<Record<string, string>> => {
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
            console.log(chalk.yellow(`[!] Module ${id} has ${params.length} params — not yet researched, skipping`));
            return;
        }
        const moduleParam = params[0] && t.isIdentifier(params[0]) ? (params[0] as t.Identifier).name : "";
        const exportsParam = params[1] && t.isIdentifier(params[1]) ? (params[1] as t.Identifier).name : "";
        const requireParam =
            params.length >= 3 && t.isIdentifier(params[2]) ? (params[2] as t.Identifier).name : undefined;
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
            console.log(chalk.yellow(`[!] Module ${id} has ${params.length} params — not yet researched, skipping`));
            return;
        }
        const moduleParam = params[0] && t.isIdentifier(params[0]) ? (params[0] as t.Identifier).name : "";
        const exportsParam = params[1] && t.isIdentifier(params[1]) ? (params[1] as t.Identifier).name : "";
        const requireParam =
            params.length >= 3 && t.isIdentifier(params[2]) ? (params[2] as t.Identifier).name : undefined;
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

    // moduleId → LibraryModuleInfo for modules that are library-classified
    const libModuleMap = new Map<string, LibraryModuleInfo>();

    let libraryCount = 0;
    for (const mod of modules) {
        if (moduleIsLibrary(mod, libSigs)) {
            console.log(chalk.gray(`[-] Module ${mod.id} matches library baseline — skipping`));
            libraryCount++;
            // Classify the library module so index.js can use proper named imports
            const info = classifyLibraryModule(mod);
            libModuleMap.set(mod.id, info);
            continue;
        }
        const statements = transformModule(mod);
        const code = validateAndFix(statements, mod.id);
        if (code === null) {
            console.log(chalk.yellow(`[~] Module ${mod.id} skipped due to unresolvable syntax errors`));
            continue;
        }
        results[mod.id] = code;
    }
    if (libSigs && libSigs.size > 0) {
        console.log(chalk.cyan(`[i] Library modules skipped: ${libraryCount}/${modules.length}`));
        // Resolve re-export chains so shim modules (e.g. 540 → 287/React) get the right identity
        resolveReexportChains(libModuleMap, modules);
    }

    // Collect everything in the IIFE body that is NOT the module-map variable into index.js.
    const topLevel = findIifeBody(ast.program) ?? ast.program.body;
    const indexStatements: t.Statement[] = [];
    for (const stmt of topLevel) {
        if (t.isVariableDeclaration(stmt)) {
            const remaining = stmt.declarations.filter((d) => !isModuleMapDeclarator(d));
            if (remaining.length > 0) indexStatements.push(t.variableDeclaration(stmt.kind, remaining));
        } else {
            indexStatements.push(stmt);
        }
    }
    if (indexStatements.length > 0) {
        console.log(chalk.cyan(`[i] Writing ${indexStatements.length} non-module statements to index.js`));
        const transformed = transformIndexStatements(indexStatements, libModuleMap.size > 0 ? libModuleMap : undefined);
        const indexCode = validateAndFix(transformed, "index");
        if (indexCode !== null) results["index"] = indexCode;
    }

    return results;
};

export default refactorReact;
