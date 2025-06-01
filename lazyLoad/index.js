import chalk from "chalk";
import frameworkDetect from "../techDetect/index.js";

const lazyload = async (url, output) => {
    console.log(chalk.cyan("[i] Loading 'Lazy Load' module"));

    const tech = await frameworkDetect(url);

    if (tech !== null) {
        if (tech === "next") {
            console.log(chalk.green("[✓] Next.js detected"));
        }
    } else {
        console.log(chalk.magenta("[!] Framework not detected :("))
    }
};

export default lazyload;
