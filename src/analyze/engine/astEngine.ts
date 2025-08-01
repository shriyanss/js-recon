import chalk from "chalk";
import { Chunks } from "../../utility/interfaces.js";
import { Rule } from "../types/index.js";

import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import _generator from "@babel/generator";
const generator = _generator.default;
import esquery from "esquery";
import { Node } from "@babel/types";
import { highlight } from "cli-highlight";
import { resolveFunctionIdentifier } from "../helpers/engineHelpers/resolveFunctionIdentifier.js";
import { findMemberExpressionAssignment } from "../helpers/engineHelpers/findMemberExpressionAssignment.js";
import { findDirectAssignment } from "../helpers/engineHelpers/findDirectAssignment.js";

const esqueryEngine = async (rule: Rule, mappedJsonData: Chunks) => {
    for (const chunk of Object.values(mappedJsonData)) {
        // first of all, load the code in ast
        const ast = parser.parse(chunk.code, {
            sourceType: "unambiguous",
            plugins: ["jsx", "typescript"],
            errorRecovery: true,
        });

        let matchCount = 0;
        let matchList: { [key: string]: { node: Node; scope: Node } } = {};
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
                    matchList[step.name] = { node, scope: ast };
                    matchCount++;
                }
                completedSteps.push(step.name);
            } else if (step.postMessageFuncResolve) {
                // since this is asking to resolve to a function declaration, we'll first get the node for it

                const selectedNode: Node = matchList[step.postMessageFuncResolve.name]?.node;

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
                                        matchList[step.name] = { node: resolvedFunction, scope: ast };
                                        matchCount++;
                                        completedSteps.push(step.name);
                                    }
                                } else if (selectedNode.arguments[1].type === "FunctionExpression") {
                                    const functionExpression = selectedNode.arguments[1];
                                    matchList[step.name] = { node: functionExpression, scope: ast };
                                    matchCount++;
                                    completedSteps.push(step.name);
                                }
                            }
                        }
                    }
                }
            } else if (step.checkAssignmentExist) {
                const selectedNode: Node = matchList[step.checkAssignmentExist.name]?.node;
                const toMatch = step.checkAssignmentExist.type;
                const memberExpression = step.checkAssignmentExist.memberExpression;

                if (selectedNode && memberExpression) {
                    const assignmentNode = findMemberExpressionAssignment(
                        selectedNode,
                        toMatch,
                        matchList[step.checkAssignmentExist.name].scope
                    );

                    if (assignmentNode) {
                        // store the matched assignment in matchList similar to earlier steps
                        matchList[step.name] = { node: assignmentNode, scope: ast };
                        matchCount++;
                        completedSteps.push(step.name);
                    }
                } else if (selectedNode) {
                    const assignmentNode = findDirectAssignment(
                        selectedNode,
                        matchList[step.checkAssignmentExist.name].scope
                    );

                    if (assignmentNode) {
                        // store the matched assignment in matchList similar to earlier steps
                        matchList[step.name] = { node: assignmentNode, scope: ast };
                        matchCount++;
                        completedSteps.push(step.name);
                    }
                }
            }
        }

        // now, check if the matchCount is equal to the length of the rule.steps
        if (matchCount === rule.steps.length) {
            const message = `[+] "${rule.name}" found in chunk ${chunk.id}`;
            const lastMatch = Object.values(matchList)[Object.keys(matchList).length - 1];
            const code = generator(lastMatch.node).code;

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
