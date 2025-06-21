import chalk from "chalk";

const techs = [
    "Next.JS (next)"
]

const endpoints = async (directory, output, tech, list) => {
    console.log(chalk.cyan("[i] Loading endpoints module"));
    
    if (list) {
        console.log(chalk.cyan("[i] Listing available technologies"));
        for (const tech of techs) {
            console.log(chalk.greenBright(`- ${tech}`));
        }
        return;
    }

    if (!directory) {
        console.log(chalk.red("[!] Please provide a directory"));
        return;
    }

    if (!tech) {
        console.log(chalk.red("[!] Please provide a technology"));
        return;
    }

    if (!output) {
        console.log(chalk.red("[!] Please provide an output file"));
        return;
    }

    console.log(chalk.cyan("[i] Extracting endpoints"));

    if (tech === "next") {
        console.log(chalk.cyan("[i] Checking for client-side paths for Next.JS"));
    }
};

export default endpoints;
