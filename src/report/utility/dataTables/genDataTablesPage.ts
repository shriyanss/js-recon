import Database from "better-sqlite3";

interface AnalysisFinding {
    ruleId: string;
    ruleName: string;
    ruleType: string;
    ruleDescription: string;
    ruleAuthor: string;
    ruleTech: string;
    severity: string;
    message: string;
    findingLocation: string;
}

interface MappedData {
    id: string;
    description: string | null;
    containsFetch: number;
    isAxiosClient: number;
    exports: string | null;
    imports: string | null;
    file: string;
}

const escapeHtml = (value: unknown): string => {
    const str = value === null || value === undefined ? "" : String(value);
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
};

const booleanIcon = (b: number | boolean) => (b ? "✅" : "❌");

const genDataTablesPage = (db: Database.Database): string => {
    const findings = db.prepare(`SELECT * FROM analysis_findings`).all() as AnalysisFinding[];
    const mapped = db.prepare(`SELECT * FROM mapped`).all() as MappedData[];

    const findingsRows = findings
        .map(
            (f) => `
            <tr>
                <td>${escapeHtml(f.ruleId)}</td>
                <td>${escapeHtml(f.ruleName)}</td>
                <td>${escapeHtml(f.ruleType)}</td>
                <td>${escapeHtml(f.ruleDescription)}</td>
                <td>${escapeHtml(f.ruleAuthor)}</td>
                <td>${escapeHtml(f.ruleTech)}</td>
                <td>${escapeHtml(f.severity)}</td>
                <td>${escapeHtml(f.message)}</td>
                <td><pre class="code-cell">${escapeHtml(f.findingLocation)}</pre></td>
            </tr>`
        )
        .join("\n");

    const mappedRows = mapped
        .map(
            (m) => `
            <tr>
                <td>${escapeHtml(m.id)}</td>
                <td>${escapeHtml(m.description)}</td>
                <td>${booleanIcon(m.containsFetch)}</td>
                <td>${booleanIcon(m.isAxiosClient)}</td>
                <td>${escapeHtml(m.exports)}</td>
                <td>${escapeHtml(m.imports)}</td>
                <td>${escapeHtml(m.file)}</td>
            </tr>`
        )
        .join("\n");

    const html = `
    <section>
      <h2>Analyze Findings (Sortable)</h2>
      <table id="findings-table" class="display data-table" style="width:100%">
        <thead>
          <tr>
            <th>Rule ID</th>
            <th>Name</th>
            <th>Type</th>
            <th>Description</th>
            <th>Author</th>
            <th>Tech</th>
            <th>Severity</th>
            <th>Message</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          ${findingsRows}
        </tbody>
      </table>

      <h2 style="margin-top: 2rem;">Mapped Data (Sortable)</h2>
      <table id="mapped-table" class="display data-table" style="width:100%">
        <thead>
          <tr>
            <th>ID</th>
            <th>Description</th>
            <th>Contains Fetch</th>
            <th>Axios Client</th>
            <th>Exports</th>
            <th>Imports</th>
            <th>File</th>
          </tr>
        </thead>
        <tbody>
          ${mappedRows}
        </tbody>
      </table>
    </section>`;

    return html;
};

export default genDataTablesPage;
