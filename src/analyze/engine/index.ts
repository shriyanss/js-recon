import { Rule } from "../types/index.js";
import { Chunks } from "../../utility/interfaces.js";
import { OpenAPISpec } from "../../utility/openapiGenerator.js";
import requestEngine from "./requestEngine.js";
import astEngine from "./astEngine.js";

export const engine = async (
    rule: Rule,
    mappedJsonData: Chunks | undefined,
    openapiData: OpenAPISpec | undefined,
    tech: "next" | "all"
) => {
    // first of all check what is rule type, and then check if the data for that is available or is undefined

    if (rule.type === "request") {
        if (!openapiData) {
            return;
        }

        let techValid = true;
        for (const t of rule.tech) {
            if (!rule.tech.includes(tech)) {
                techValid = false;
            }
        }

        if (techValid || tech === "all") {
            requestEngine(rule, openapiData);
        }
    } else if (rule.type === "ast") {
        if (!mappedJsonData) {
            return;
        }

        let techValid = true;
        for (const t of rule.tech) {
            if (!rule.tech.includes(tech)) {
                techValid = false;
            }
        }

        if (techValid || tech === "all") {
            astEngine(rule, mappedJsonData);
        }
    }
};

export default engine;
