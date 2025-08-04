import Database from "better-sqlite3";

const initReportDb = (sqliteDbPath: string) => {
    const db = new Database(sqliteDbPath);
    db.close();
};

export default initReportDb;
