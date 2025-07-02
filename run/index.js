import endpoints from "../endpoints/index.js";
import strings from "../strings/index.js";
import map from "../map/index.js";
import * as globals from "../utility/globals.js";
import path from "path";
import lazyLoad from "../lazyLoad/index.js";

export default async (cmd) => {
    globals.setApiGatewayConfigFile(cmd.apiGatewayConfig);
    globals.setUseApiGateway(cmd.apiGateway);
    globals.setDisableCache(cmd.disableCache);
    globals.setRespCacheFile(cmd.cacheFile);
    globals.setYes(cmd.yes);

    console.log("[+] Starting analysis...");

    console.log("\n[1/4] Running lazyload to download JavaScript files...");
    await lazyLoad(cmd.url, cmd.output, cmd.strictScope, cmd.scope.split(","), cmd.threads, cmd.subsequentRequests, cmd.urlsFile);
    console.log("[+] Lazyload complete.");

    console.log("\n[2/4] Running endpoints to extract API endpoints...");
    await endpoints(cmd.url, cmd.output, path.join(cmd.output, "endpoints"), ["md"], undefined, false, undefined);
    console.log("[+] Endpoints extraction complete.");

    console.log("\n[3/4] Running strings to extract strings, URLs, and secrets...");
    await strings(cmd.output, path.join(cmd.output, "strings.json"), true, path.join(cmd.output, "extracted_urls"), true, true, true);
    console.log("[+] Strings extraction complete.");

    console.log("\n[4/4] Running map to analyze and map functions...");
    await map(cmd.output, path.join(cmd.output, 'mapped'), ['json'], undefined, false, false);
    console.log("[+] Map analysis complete.");

    console.log("\n[+] Analysis complete. All results saved to the '" + cmd.output + "' directory.");
};
