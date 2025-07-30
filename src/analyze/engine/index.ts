import { Rule } from "../types/index.js";
import { Chunks } from "../../utility/interfaces.js";
import { OpenAPISpec } from "../../utility/openapiGenerator.js";
import chalk from "chalk";
import requestEngine from "./requestEngine.js";

export const engine = async (rule: Rule, mappedJsonData: Chunks | undefined, openapiData: OpenAPISpec | undefined) => {
    // first of all check what is rule type, and then check if the data for that is available or is undefined

    if (rule.type === "request") {
        if (!openapiData) {
            return;
        }
        requestEngine(rule, openapiData);
    }
};

export default engine;
