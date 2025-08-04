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

const addAnalyze = async (markdown: string, db: Database.Database): Promise<string> => {
    let toReturn = markdown;
    toReturn += `\n## Analyze Results\n`;
    const findings = db.prepare(`SELECT * FROM analysis_findings`).all() as AnalysisFinding[];
    if (findings.length > 0) {
        const groupedFindings: { [key: string]: AnalysisFinding[] } = {};
        for (const finding of findings) {
            if (!groupedFindings[finding.ruleType]) {
                groupedFindings[finding.ruleType] = [];
            }
            groupedFindings[finding.ruleType].push(finding);
        }

        for (const ruleType in groupedFindings) {
            toReturn += `### ${ruleType.toUpperCase()}\n`;
            for (const finding of groupedFindings[ruleType]) {
                toReturn += `#### ${finding.ruleName}, ${finding.ruleDescription}\n`;
                let findingLocationBlock = "";
                if (ruleType.toLowerCase() === "ast") {
                    findingLocationBlock = "```js\n" + finding.findingLocation + "\n```";
                } else {
                    findingLocationBlock = "```\n" + finding.findingLocation + "\n```";
                }
                toReturn += `${findingLocationBlock}\n`;
                toReturn += `- **Rule ID:** ${finding.ruleId}\n`;
                toReturn += `- **Severity:** ${finding.severity}\n`;
                toReturn += `- **Message:** ${finding.message}\n`;
                toReturn += `- **Author:** ${finding.ruleAuthor}\n`;
                toReturn += `- **Technology:** ${finding.ruleTech}\n\n`;
            }
        }
    }

    return toReturn;
};

export default addAnalyze;
