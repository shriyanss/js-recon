import { get } from "./genReq.js";
import chalk from "chalk";
import checkFireWallBlocking from "./checkFireWallBlocking.js";

const checkFeasibility = async (url) => {
    console.log(chalk.cyan(`[i] Checking feasibility of API Gateway with ${url}`));
    try {
        // send 10 requests, and check if any of those contain any signs of blocking
        for (let i = 0; i < 10; i++) {
            const response = await get(url);
            const isFireWallBlocking = await checkFireWallBlocking(response);
            if (isFireWallBlocking) {
                console.log(chalk.magenta("[!] Please try again without API Gateway"));
                return;
            }
        }
        console.log(
            chalk.green("[✓] Feasibility check passed."),
            chalk.dim("However, this doesn't represent the true nature of the firewall used.")
        );
    } catch (error) {
        console.log(chalk.red(`[!] An error occured in feasibility check: ${error}`));
    }
};

export default checkFeasibility;
