import { Rule } from "../types/index.js";
import { Chunks } from "../../utility/interfaces.js";
import { OpenAPISpec } from "../../utility/openapiGenerator.js";
import chalk from "chalk";
import requestEngine from "./requestEngine.js";
import esqueryEngine from "./esqueryEngine.js";

export const engine = async (
    rule: Rule,
    mappedJsonData: Chunks | undefined,
    openapiData: OpenAPISpec | undefined,
    tech: string
) => {
    // first of all check what is rule type, and then check if the data for that is available or is undefined

    if (rule.type === "request") {
        if (!openapiData) {
            return;
        }

        if (tech.split(",").includes(rule.tech) || tech === "all") {
            requestEngine(rule, openapiData);
        }
    } else if (rule.type === "esquery") {
        if (!mappedJsonData) {
            return;
        }

        if (tech.split(",").includes(rule.tech) || tech === "all") {
            esqueryEngine(rule, mappedJsonData);
        }
    }
};

export default engine;
