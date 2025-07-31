import { Rule } from "../types/index.js";
import { OpenAPISpec } from "../../utility/openapiGenerator.js";
import chalk from "chalk";

const engine = async (rule: Rule, openapiData: OpenAPISpec) => {
    for (const path in openapiData.paths) {
        const methods = openapiData.paths[path];
        for (const method in methods) {
            const operation = methods[method];
            if (!operation) continue;

            let successfulSteps = 0;

            for (const step of rule.steps) {
                let stepSuccess = false;

                if (step.request.type === "url") {
                    const urlContainsName = path.includes(step.request.name);
                    if (step.request.condition === "contains") {
                        stepSuccess = urlContainsName;
                    } else if (step.request.condition === "absent") {
                        stepSuccess = !urlContainsName;
                    }
                } else if (step.request.type === "headers") {
                    const headers = operation.parameters?.filter((param) => param.in === "header");

                    if (step.request.condition === "contains") {
                        if (headers?.some((h) => h.name === step.request.name)) {
                            stepSuccess = true;
                        }
                    } else if (step.request.condition === "absent") {
                        if (!headers?.some((h) => h.name === step.request.name)) {
                            stepSuccess = true;
                        }
                    }
                } else if (step.request.type === "method") {
                    if (step.request.condition === "is") {
                        stepSuccess = method.toLowerCase() === step.request.name.toLowerCase();
                    } else if (step.request.condition === "is_not") {
                        stepSuccess = method.toLowerCase() !== step.request.name.toLowerCase();
                    }
                }

                if (stepSuccess) {
                    successfulSteps++;
                }
            }

            if (successfulSteps === rule.steps.length) {
                // get the severity of the rule
                if (rule.severity === "info") {
                    console.log(chalk.cyan(`[+] "${rule.name}" found in ${path} [${method.toUpperCase()}]`));
                } else if (rule.severity === "low") {
                    console.log(chalk.yellow(`[+] "${rule.name}" found in ${path} [${method.toUpperCase()}]`));
                } else if (rule.severity === "medium") {
                    console.log(chalk.magenta(`[+] "${rule.name}" found in ${path} [${method.toUpperCase()}]`));
                } else if (rule.severity === "high") {
                    console.log(chalk.red(`[+] "${rule.name}" found in ${path} [${method.toUpperCase()}]`));
                }
            }
        }
    }
};

export default engine;
