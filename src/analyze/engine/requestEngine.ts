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

                // Skip header checks that don't match the current method
                if (
                    step.request.type === "headers" &&
                    step.request.method &&
                    step.request.method.toLowerCase() !== method.toLowerCase()
                ) {
                    continue;
                }

                if (step.request.type === "url") {
                    if (step.request.condition === "contains") {
                        if (path.includes(step.request.name)) {
                            stepSuccess = true;
                        }
                    } else if (step.request.condition === "absent") {
                        if (!path.includes(step.request.name)) {
                            stepSuccess = true;
                        }
                    }
                } else if (step.request.type === "headers") {
                    const headers = operation.parameters?.filter(
                        (param) => param.in === "header"
                    );

                    if (step.request.condition === "contains") {
                        if (headers?.some((h) => h.name === step.request.name)) {
                            stepSuccess = true;
                        }
                    } else if (step.request.condition === "absent") {
                        if (!headers?.some((h) => h.name === step.request.name)) {
                            stepSuccess = true;
                        }
                    }
                }

                if (stepSuccess) {
                    successfulSteps++;
                }
            }

            if (successfulSteps === rule.steps.length) {
                console.log(
                    chalk.green(`Rule ${rule.name} passed for ${path} [${method.toUpperCase()}]`)
                );
            }
        }
    }
};

export default engine;
