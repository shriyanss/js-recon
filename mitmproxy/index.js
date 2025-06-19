import chalk from "chalk";
// import { exec, spawn } from "child_process";
import fs from "fs";
import * as globals from "../utility/globals.js";
import inquirer from "inquirer";

const serverUrl = `http://localhost:${globals.getMitmParseServerPort()}/mitmparse`;

// python script that will be run as an extension for mitmproxy
const pythonScript = `
import requests

server_url = "${serverUrl}"

def response(flow):
    data = {
        "host": flow.request.host,
        "method": flow.request.method,
        "path": flow.request.path,
        "url": flow.request.pretty_url,
        "request_headers": dict(flow.request.headers),
        "status_code": flow.response.status_code,
        "response_headers": dict(flow.response.headers),
        "request_content": flow.request.get_text(),
        "response_content": flow.response.get_text()
    }

    requests.post(server_url, json=data)
`

const mitmproxy = async () => {
    console.log(chalk.cyan("[i] Starting mitmproxy"));

    // check if the mitmdump is installed
    // exec("mitmdump --version", (error, stdout, stderr) => {
    //     if (stdout.includes("Mitmproxy")) {
    //         console.log(chalk.green(`[✓] mitmdump is installed`));
    //     } else {
    //         console.log(chalk.red(`[!] mitmdump is not installed`));
    //         return;
    //     }
    // });

    // write the python script
    fs.writeFileSync(globals.getMitmParseScript(), pythonScript);

    // start mitmdump
    const mitmdumpArgs = ['-s', globals.getMitmParseScript(), '-p', globals.getMitmPort()];
    console.log(chalk.yellow(`[i] Please run mitmdump with the following command *in the current directory*:`));
    console.log(chalk.bgGreen(`mitmdump ${mitmdumpArgs.join(' ')}`));

    // ask the user if they've started the process
    const answer = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'started',
            message: 'Have you started the mitmdump process?',
            default: true,
        },
    ]);

    if (!answer.started) {
        console.log(chalk.red(`[!] mitmdump process not started`));
        process.exit(1);
    }

    // const mitmdumpProcess = spawn('mitmdump', mitmdumpArgs);

    // mitmdumpProcess.stdout.on('data', (data) => {
    //     const output = data.toString();
    //     // Log all stdout for debugging, but trim to avoid excessive logging if noisy
    //     console.log(`mitmdump stdout: ${output.trim()}`); 
    //     // Check for a specific success message from mitmdump
    //     if (output.includes("HTTP(S) proxy listening at")) {
    //         console.log(chalk.green(`[✓] mitmdump started successfully and listening on port ${globals.getMitmPort()}`));
    //     }
    // });


    // mitmdumpProcess.stderr.on('data', (data) => {
    //     console.error(chalk.red(`mitmdump stderr: ${data.toString().trim()}`));
    // });

    // mitmdumpProcess.on('error', (error) => {
    //     console.error(chalk.red(`[!] Failed to start mitmdump process: ${error.message}`));
    // });

    // return null;
};

// Wrap the main logic in an async function to use await
// const main = async () => {
//     let mitmProcessInstance = await mitmproxy();

//     // kill the process
//     if (mitmProcessInstance) {
//         console.log(chalk.yellow('[i] Attempting to kill mitmdump process...'));
//         mitmProcessInstance.kill();
//         console.log(chalk.green('[✓] mitmdump process kill signal sent.'));
//     } else {
//         console.log(chalk.red('[!] mitmproxy process instance not found, cannot kill.'));
//     }
// };

// main().catch(error => console.error(chalk.red(`[!] An error occurred in main execution: ${error}`)));

export default mitmproxy;