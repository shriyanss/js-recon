import chalk from "chalk";
import initReportDb from "./utility/initReportDb.js";
import fs from "fs";
import { Chunks } from "../utility/interfaces.js";
import { populateMappedJson } from "./utility/populateDb/populateMappedJson.js";
import Database from "better-sqlite3";
import { EngineOutput } from "../analyze/helpers/outputHelper.js";
import { populateAnalysisFindings } from "./utility/populateDb/populateAnalysisFindings.js";

const report = async (
    sqliteDbPath: string,
    mappedJsonFilePath: string | undefined,
    analyzeJsonFilePath: string | undefined
) => {
    console.log(chalk.cyan("[i] Running 'report' module"));

    // check if db exists. if not, init
    if (!fs.existsSync(sqliteDbPath)) {
        await initReportDb(sqliteDbPath);
        console.log(chalk.green("[✓] Report database initialized successfully"));
    }

    const db = new Database(sqliteDbPath);

    // first, populate mapped.json
    if (mappedJsonFilePath) {
        const chunks: Chunks = JSON.parse(fs.readFileSync(mappedJsonFilePath, "utf8"));
        await populateMappedJson(db, chunks);
    }

    // then, move to analyze.json
    if (analyzeJsonFilePath) {
        const findings: EngineOutput[] = JSON.parse(fs.readFileSync(analyzeJsonFilePath, "utf8"));
        await populateAnalysisFindings(db, findings);
    }
};

export default report;
