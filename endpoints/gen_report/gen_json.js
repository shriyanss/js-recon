import fs from "fs";
import chalk from "chalk";
import resolvePath from "../../utility/resolvePath.js";

let result = {};

const iterate_n_store = (url) => {
    // Parse the URL once and extract the bits we need
    const { origin, pathname } = new URL(url);

    // Ensure we have a container object for this origin
    if (!result[origin]) {
        result[origin] = {};
    }

    // Always insert the root path for this origin
    if (!result[origin]["/"]) {
        result[origin]["/"] = {};
    }

    // Normalise the pathname – strip leading/trailing slashes and split into segments
    const segments = pathname === "/" ? [] : pathname.replace(/^\/|\/$/g, "").split("/");

    let cumulativePath = "";   // will build up like "/app", "/app/dashboard"
    let currentNode = result[origin];

    for (const segment of segments) {
        cumulativePath += `/${segment}`;
        if (!currentNode[cumulativePath]) {
            currentNode[cumulativePath] = {};
        }
        // descend into the newly created / already existing child
        currentNode = currentNode[cumulativePath];
    }
};

const gen_json = async (url, hrefs, output) => {
    // iterate over hrefs
    for (const href of hrefs) {
        if (href.startsWith("mailto:") || href.startsWith("tel:")) {
            continue;
        }

        if (href.startsWith("http")) {
            iterate_n_store(href);
        }

        if (href.startsWith("/")) {
            iterate_n_store(await resolvePath(url, href));
        }
    }

    fs.writeFileSync(`${output}.json`, JSON.stringify(result, null, 2));

    console.log(chalk.green(`[✓] Generated JSON report at ${output}.json`));
    return result;
};

export default gen_json;
