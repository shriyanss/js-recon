import makeRequest from "../../utility/makeReq.js";
import chalk from "chalk";

const vue_reconstructSourceMaps = async (url: string, jsFilesToDownload: string[]) => {
    // get the contents of first file, and check if it has the sourceMappingURL

    let sourceMapUrls:string[] = [];
    
    const req = await makeRequest(jsFilesToDownload[0]);
    const content = await req.text();

    // check if it has the sourceMappingURL
    if (!(content.includes("sourceMappingURL=") || content.includes("sourceMappingURL ="))) {
        return sourceMapUrls;
    }

    console.log(chalk.green("[✓] Found sourceMappingURL"));
    
    // now that one file has this, iterate through all the files, and reconstruct the source maps
    for (const jsFile of jsFilesToDownload) {
        const req = await makeRequest(jsFile);
        const content = await req.text();
        
        // get the sourceMappingURL
        let sourceMappingURL_reg = content.match(/sourceMappingURL=([^"]+)/);
        if (sourceMappingURL_reg) {
            // strip the newline, and assign to a new var
            const sourceMappingURL = sourceMappingURL_reg[1].replace(/\n/g, "");

            // reconstruct the URL
            let reconstructedUrl:string = "";
            if (sourceMappingURL.startsWith("/")) {
                reconstructedUrl = (new URL(jsFile).origin) + sourceMappingURL;
            } else if (sourceMappingURL.startsWith("./")) {
                reconstructedUrl = (new URL(jsFile).origin) + (new URL(jsFile).pathname) + sourceMappingURL;
            } else if (sourceMappingURL.startsWith("http")) {
                reconstructedUrl = sourceMappingURL;
            } else {
                reconstructedUrl = new URL(sourceMappingURL, jsFile).href;
            }

            // now that we've got the mapping URL, just push it to the array
            sourceMapUrls.push(reconstructedUrl);
        }
    }

    return sourceMapUrls;
}

export default vue_reconstructSourceMaps;
