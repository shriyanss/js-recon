import chalk from "chalk";
import { Chunks } from "../../utility/interfaces.js";
import { Rule } from "../types/index.js";

import parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;
import _generator from "@babel/generator";
const generator = _generator.default;
import esquery from "esquery";
import { Node } from "@babel/types";
import { highlight } from "cli-highlight";
import { resolveFunctionIdentifier } from "../helpers/engineHelpers/resolveFunctionIdentifier.js";

const esqueryEngine = async (rule: Rule, mappedJsonData: Chunks) => {
    console.log(chalk.cyan("[i] Loading esquery engine..."));

    for (const chunk of Object.values(mappedJsonData)) {
        // first of all, load the code in ast
        const ast = parser.parse(chunk.code, {
            sourceType: "unambiguous",
            plugins: ["jsx", "typescript"],
            errorRecovery: true,
        });

        let matchCount = 0;
        let matchList: { [key: string]: Node } = {};
        const completedSteps: string[] = [];

        // iterate through the steps in the rule
        for (const step of rule.steps) {
            // if it is an esquery step, then only proceed
            if (step.esquery) {
                const selector = step.esquery.query;

                // match the query against what is there in the user defined config file
                const matches: Node[] = esquery(ast, selector);

                for (const node of matches) {
                    // now that a match is found, push that node to the matchList
                    matchList[step.name] = node;
                    matchCount++;
                }
                completedSteps.push(step.name);
            } else if (step.postMessageFuncResolve) {
                // since this is asking to resolve to a function declaration, we'll first get the node for it

                const selectedNode: Node = matchList[step.postMessageFuncResolve.name];

                if (selectedNode) {
                    // check if it a function declaration or a call expression
                    if (selectedNode.type === "CallExpression") {
                        if (
                            selectedNode.callee.type === "MemberExpression" &&
                            selectedNode.callee.property.type === "Identifier" &&
                            selectedNode.callee.property.name === "addEventListener" &&
                            selectedNode.arguments[0].type === "StringLiteral" &&
                            selectedNode.arguments[0].value === "message"
                        ) {
                            if (selectedNode.arguments.length === 2) {
                                // console.log(selectedNode.arguments[1].type);
                                // if the type is identifier
                                if (selectedNode.arguments[1].type === "Identifier") {
                                    // resolve where it is being assigned
                                    const functionIdentifier = selectedNode.arguments[1];
                                    const resolvedFunction = resolveFunctionIdentifier(functionIdentifier, ast);

                                    if (resolvedFunction) {
                                        // console.log(
                                        //     chalk.green(
                                        //         "[✓] Successfully resolved function declaration:"
                                        //     )
                                        // );
                                        // const { code } = generator(resolvedFunction);
                                        matchList[step.name] = resolvedFunction;
                                        matchCount++;
                                        completedSteps.push(step.name);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // now, check if the matchCount is equal to the length of the rule.steps
        if (matchCount === rule.steps.length) {
            const message = `[✓] "${rule.name}" found in chunk ${chunk.id}`;
            const code = generator(Object.values(matchList)[Object.keys(matchList).length - 1]).code;

            // print the message based on the severity of the rule
            if (rule.severity === "info") {
                console.log(chalk.cyan(message));
            } else if (rule.severity === "low") {
                console.log(chalk.yellow(message));
            } else if (rule.severity === "medium") {
                console.log(chalk.magenta(message));
            } else if (rule.severity === "high") {
                console.log(chalk.red(message));
            }

            console.log(
                highlight(code, {
                    language: "javascript",
                    ignoreIllegals: true,
                    theme: undefined,
                })
            );
        }
    }
};

export default esqueryEngine;
