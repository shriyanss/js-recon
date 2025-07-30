import chalk from "chalk";
import { Chunks } from "../../utility/interfaces.js";
import { Rule } from "../types/index.js";

import parser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default;
import _generator from "@babel/generator";
const generator = _generator.default;
import esquery from "esquery";

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

        // iterate through the steps in the rule
        for (const step of rule.steps) {
            // if it is an esquery step, then only proceed
            if (step.esquery) {
                const selector = step.esquery.query;

                // match the query against what is there in the user defined config file
                const matches = esquery(ast, selector);

                for (const node of matches) {
                    const output = generator(node).code;
                    console.log(output);
                }
            }
        }
    }
};

export default esqueryEngine;
