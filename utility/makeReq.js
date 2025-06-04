
const makeRequest = async (url, args) => {
    if (args === undefined) {
        args = {};
    }
    let res;
    let counter = 0;
    while (true) {
        try {
            res = await fetch(url, args);
            if (res) {
                break;
            }
        } catch (err) {
            counter++;
            if (counter > 10) {
                console.log(chalk.red(`[!] Failed to fetch ${url}`));
                return null;
            }
            // sleep 0.5 s before retrying
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
        }
    }
    return res;
}

export default makeRequest;