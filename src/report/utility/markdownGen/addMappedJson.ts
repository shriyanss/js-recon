import Database from "better-sqlite3";

interface MappedData {
    id: string;
    description: string | null;
    containsFetch: number;
    isAxiosClient: number;
    exports: string | null;
    imports: string | null;
    file: string;
}

const addMappedJson = async (markdown: string, db: Database.Database): Promise<string> => {
    let toReturn = markdown;

    const mappedData = db.prepare(`SELECT * FROM mapped`).all() as MappedData[];

    for (const item of mappedData) {
        toReturn += `## ${item.id}\n`;
        toReturn += `- Description: ${item.description || "N/A"}\n`;
        toReturn += `- Contains Fetch: ${!!item.containsFetch}\n`;
        toReturn += `- Is Axios Client: ${!!item.isAxiosClient}\n`;
        toReturn += `- Exports: ${item.exports || "N/A"}\n`;
        toReturn += `- Imports: ${item.imports || "N/A"}\n`;
        toReturn += `- File: ${item.file}\n\n`;
    }

    return toReturn;
};

export default addMappedJson;
