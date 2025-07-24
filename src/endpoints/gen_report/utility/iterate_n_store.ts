import resolvePath from "../../../utility/resolvePath.js";

const iterate_n_store = async (baseUrl: string, urls: string[]) => {
    let result = {};
    for (let url of urls) {
        if (url.startsWith("mailto:") || url.startsWith("tel:")) {
            continue;
        }

        if (url.startsWith("/")) {
            url = resolvePath(baseUrl, url);
        }

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

        let cumulativePath = ""; // will build up like "/app", "/app/dashboard"
        let currentNode = result[origin];

        for (const segment of segments) {
            cumulativePath += `/${segment}`;
            if (!currentNode[cumulativePath]) {
                currentNode[cumulativePath] = {};
            }
            // descend into the newly created / already existing child
            currentNode = currentNode[cumulativePath];
        }
    }

    return result;
};

export default iterate_n_store;
