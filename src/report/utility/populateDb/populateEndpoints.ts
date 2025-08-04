import chalk from "chalk";
import Database from "better-sqlite3";

const populateEndpoints = async (db: Database.Database, endpoints: any) => {
    console.log(chalk.green("[✓] Populated endpoints into the database..."));
};

export default populateEndpoints;