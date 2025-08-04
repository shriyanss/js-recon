import chalk from "chalk";
import initReportDb from "./utility/initReportDb.js";

const report = async (sqliteDbPath: string, mappedJsonFilePath: string | undefined) => {
    console.log(chalk.cyan("[i] Running 'report' module"));

    await initReportDb(sqliteDbPath);
    console.log(chalk.green("[✓] Report database initialized successfully"));
};

export default report;
