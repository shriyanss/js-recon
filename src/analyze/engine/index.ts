import { Rule } from "../types/index.js";
import { Chunks } from "../../utility/interfaces.js";
import { OpenAPISpec } from "../../utility/openapiGenerator.js";
import chalk from "chalk";

export const engine = async (rule: Rule, mappedJsonData: Chunks | undefined, openapiData: OpenAPISpec | undefined) => {
    // first of all check what is rule type, and then check if the data for that is available or is undefined

    if (rule.type === "request") {
        if (!openapiData) {
            return;
        }
    }

    let stepsSuccess: string[] = [];

    // iterate through the steps
    for (const step of rule.steps) {
        // check if there are any requirements
        if (step.requires) {
            // check if all the requirements are met
            for (const requirement of step.requires) {
                if (!stepsSuccess.includes(requirement)) {
                    return;
                }
            }
        }

        // now check what request it is trying to get
        if (step.request.type === "headers") {
        }
    }
};

export default engine;
