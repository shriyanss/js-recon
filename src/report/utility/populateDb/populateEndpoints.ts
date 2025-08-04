import chalk from "chalk";
import Database from "better-sqlite3";

const populateEndpoints = async (db: Database.Database, endpoints: any) => {
    const insert = db.prepare("INSERT OR IGNORE INTO endpoints (url) VALUES (?)");

    // clear the endpoints table
    db.prepare("DELETE FROM endpoints").run();

    const insertPaths = (base: string, paths: object) => {
        for (const path in paths) {
            // The path is the key itself, which is a full path
            const fullUrl = base + path;
            try {
                insert.run(fullUrl);
            } catch (error) {
                // Ignore unique constraint errors if a URL is already present
                if (!error.message.includes("UNIQUE constraint failed")) {
                    console.error(`Error inserting ${fullUrl}:`, error);
                }
            }

            // Recursively process nested paths
            if (Object.keys(paths[path]).length > 0) {
                insertPaths(base, paths[path]);
            }
        }
    };

    db.transaction(() => {
        for (const baseUrl in endpoints) {
            insertPaths(baseUrl, endpoints[baseUrl]);
        }
    })();

    console.log(chalk.green("[✓] Populated endpoints into the database..."));
};

export default populateEndpoints;
