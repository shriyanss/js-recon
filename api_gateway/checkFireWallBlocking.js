import chalk from "chalk";

const checkFireWallBlocking = async (body) => {
    // check common signs of CF first
    if (body.includes("<title>Just a moment...</title>")) {
        console.log(chalk.red("[!] Cloudflare detected"));
        return true;
    } else if (
        body.includes("<title>Attention Required! | Cloudflare</title>")
    ) {
        console.log(chalk.red("[!] Cloudflare detected"));
        return true;
    }

    return false;
};

export default checkFireWallBlocking;
