import chalk from "chalk";
import { Chunks } from "../../../utility/interfaces.js";
import Database from "better-sqlite3";

export const populateMappedJson = async (
    db: Database.Database,
    chunks: Chunks
) => {
    // Clear the table before inserting new data
    db.prepare(`DELETE FROM mapped`).run();

    const insert = db.prepare(
        `INSERT INTO mapped (id, description, loadedOn, containsFetch, isAxiosClient, exports, callStack, code, imports, file) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertMany = db.transaction((items) => {
        for (const item of items) {
            insert.run(
                item.id,
                item.description,
                JSON.stringify(item.loadedOn),
                item.containsFetch ? 1 : 0,
                item.isAxiosClient ? 1 : 0,
                JSON.stringify(item.exports),
                JSON.stringify(item.callStack),
                item.code,
                JSON.stringify(item.imports),
                item.file
            );
        }
    });

    insertMany(Object.values(chunks));
    console.log(chalk.green("[✓] Populated mapped data into the database..."));
};
