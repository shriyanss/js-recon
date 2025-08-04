import chalk from "chalk";
import fs from "fs";
import Database from "better-sqlite3";
import initReportDb from "./utility/initReportDb.js";

const report = async (sqliteDbPath: string, mappedJsonFilePath: string | undefined) => {
    console.log(chalk.cyan("[i] Running 'report' module"));

    initReportDb(sqliteDbPath);
};

export default report;
