import { Rule } from "../types/index.js";
import { OpenAPISpec } from "../../utility/openapiGenerator.js";
import chalk from "chalk";

export const engine = async (rule: Rule, openapiData: OpenAPISpec) => {
    // iterate through all the requests in the openapidata
    for (const path in openapiData.paths) {
        let stepsSuccess: string[] = [];

        // iterate through the steps
        for (const step of rule.steps) {
            // check what this step if about. Like url or headers
            if (step.request.type === "headers") {
                // since this is about headers, then get the headers for this
                const headers = openapiData.paths[path][step.request.method].parameters?.filter(
                    (param) => param.in === "header"
                );

                // now, get the condition and check those
                if (step.request.condition === "contains") {
                    // now, check if the header exists
                    for (const header of headers) {
                        if (header.name === step.request.name) {
                            stepsSuccess.push(step.name);
                        }
                    }
                } else if (step.request.condition === "absent") {
                    // now, check if the header does not exist
                    let headerExists = false;
                    for (const header of headers) {
                        if (header.name === step.request.name) {
                            headerExists = true;
                        }
                    }
                    if (!headerExists) {
                        stepsSuccess.push(step.name);
                    }
                }
            } else if (step.request.type === "url") {
                // now, get the condition and check those
                if (step.request.condition === "contains") {
                    // now, check if the url contains the name
                    if (path.includes(step.request.name)) {
                        stepsSuccess.push(step.name);
                    }
                }
            }
        }

        // check if all steps are successful
        if (stepsSuccess.length === rule.steps.length) {
            console.log(chalk.green(`Rule ${rule.name} passed for ${path}`));
        }
    }
};

export default engine;
