import chalk from "chalk";
import initReportDb from "./utility/initReportDb.js";
import fs from "fs";
import { Chunks } from "../utility/interfaces.js";
import { populateMappedJson } from "./utility/populateDb/populateMappedJson.js";
import Database from "better-sqlite3";
import { EngineOutput } from "../analyze/helpers/outputHelper.js";
import { populateAnalysisFindings } from "./utility/populateDb/populateAnalysisFindings.js";
import populateEndpoints from "./utility/populateDb/populateEndpoints.js";
import populateMappedOpenapi from "./utility/populateDb/populateMappedOpenapi.js";
import genHtml from "./utility/genHtml.js";

/**
 * Generates comprehensive HTML reports from analysis results.
 *
 * This function consolidates data from various analysis modules (mapping, analysis,
 * endpoints, OpenAPI) into a SQLite database and generates an HTML report with
 * interactive visualizations and detailed findings.
 *
 * @param sqliteDbPath - Path to the SQLite database file for storing report data
 * @param mappedJsonFilePath - Path to the mapped JSON file containing code analysis
 * @param analyzeJsonFilePath - Path to the analysis results JSON file
 * @param endpointsJsonFilePath - Path to the endpoints JSON file
 * @param mappedOpenapiJsonFilePath - Path to the mapped OpenAPI specification file
 * @param reportFileName - Base filename for the generated HTML report (without extension)
 * @returns Promise that resolves when report generation is complete
 */
const report = async (
    sqliteDbPath: string,
    mappedJsonFilePath: string | undefined,
    analyzeJsonFilePath: string | undefined,
    endpointsJsonFilePath: string | undefined,
    mappedOpenapiJsonFilePath: string | undefined,
    reportFileName: string | undefined
): Promise<void> => {
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

    // populate the endpoints
    if (endpointsJsonFilePath) {
        const endpoints = JSON.parse(fs.readFileSync(endpointsJsonFilePath, "utf8"));
        await populateEndpoints(db, endpoints);
    }

    // populate the mapped openapi
    if (mappedOpenapiJsonFilePath) {
        const openapi = JSON.parse(fs.readFileSync(mappedOpenapiJsonFilePath, "utf8"));
        await populateMappedOpenapi(db, openapi);
    }

    // finally, generate HTML report
    if (reportFileName) {
        await genHtml(`${reportFileName}.html`, db);
    }
};

export default report;
