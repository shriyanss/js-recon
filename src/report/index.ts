import chalk from "chalk";
import initReportDb from "./utility/initReportDb.js";
import fs from "fs";
import { Chunks } from "../utility/interfaces.js";
import { populateMappedJson } from "./utility/populateDb/populateMappedJson.js";
import Database from "better-sqlite3";

const report = async (sqliteDbPath: string, mappedJsonFilePath: string | undefined) => {
    console.log(chalk.cyan("[i] Running 'report' module"));

    // check if db exists. if not, init
    if (!fs.existsSync(sqliteDbPath)) {
        await initReportDb(sqliteDbPath);
        console.log(chalk.green("[✓] Report database initialized successfully"));
    }

    const db = new Database(sqliteDbPath);

    if (mappedJsonFilePath) {
        const chunks: Chunks = JSON.parse(fs.readFileSync(mappedJsonFilePath, "utf8"));
        await populateMappedJson(db, chunks);
    }
};

export default report;
