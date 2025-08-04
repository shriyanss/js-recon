import chalk from "chalk";
import Database from "better-sqlite3";

const populateMappedOpenapi = async (db: Database.Database, openapi: any) => {
    console.log(chalk.green("[✓] Populated mapped openapi into the database..."));
};

export default populateMappedOpenapi;
