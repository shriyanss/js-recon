import path from "path";
import { McpConfig } from "./config.js";
import { getJobManager } from "./jobs.js";
import { summarizeLazyloadOutput, summarizeRunOutput } from "./tools.js";
import { findSkill, parseSkillArgs, renderSkill, loadSkills, Skill, SkillPreAction } from "./skills.js";

export interface IntentToolState {
    config: McpConfig;
    cwd: string;
    lastToolOutput?: string;
    lastOutputDir?: string;
    lastModule?: "lazyload" | "run";
}

export type IntentAction = "lazyload" | "run" | "parse_lazyload" | "parse_run" | "skill" | "chat";

export interface Intent {
    action: IntentAction;
    url?: string;
    skillName?: string;
    skillArgs?: Record<string, string>;
}

/**
 * Returns true if the user message looks like it intends a known skill.
 * Matches when the message lower-case contains the skill name or its kebab/space variant.
 */
const matchSkillIntent = (message: string): { name: string; args: Record<string, string> } | null => {
    const skills = loadSkills();
    if (skills.length === 0) return null;
    const lower = message.toLowerCase();
    const urlMatch = message.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : undefined;

    for (const s of skills) {
        const variants = [
            s.name.toLowerCase(),
            s.name.replace(/_/g, " ").toLowerCase(),
            s.name.replace(/_/g, "-").toLowerCase(),
        ];
        if (variants.some((v) => lower.includes(v))) {
            const args: Record<string, string> = {};
            if (url && s.params.some((p) => p.name === "target")) args.target = url;
            return { name: s.name, args };
        }
    }
    return null;
};

/**
 * Detects intent from a user message and decides whether to invoke a tool/skill.
 */
export const detectIntent = (message: string): Intent => {
    const lower = message.toLowerCase();

    if (
        lower.includes("parse") ||
        lower.includes("summarize") ||
        lower.includes("summary") ||
        lower.includes("overview") ||
        lower.includes("show results") ||
        lower.includes("what did you find")
    ) {
        if (
            lower.includes("lazyload") ||
            lower.includes("lazy load") ||
            lower.includes("directory") ||
            lower.includes("files")
        ) {
            return { action: "parse_lazyload" };
        }
        return { action: "parse_run" };
    }

    const urlMatch = message.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : undefined;

    // Explicit "pentest" intent: route to a pentest-flavoured skill if one is loaded.
    if (/\bpentest\b/.test(lower)) {
        const skills = loadSkills();
        const candidate =
            skills.find((s) => s.name === "web_app_pentest") ||
            skills.find((s) => s.name.endsWith("_pentest")) ||
            skills.find((s) => s.description.toLowerCase().includes("pentest"));
        if (candidate) {
            const args: Record<string, string> = {};
            if (url && candidate.params.some((p) => p.name === "target")) args.target = url;
            return { action: "skill", skillName: candidate.name, skillArgs: args };
        }
    }

    const skill = matchSkillIntent(message);
    if (skill) {
        return { action: "skill", skillName: skill.name, skillArgs: skill.args };
    }

    if (
        lower.includes("run against") ||
        lower.includes("full scan") ||
        lower.includes("full pipeline") ||
        lower.includes("full analysis") ||
        lower.includes("analyze")
    ) {
        return { action: "run", url };
    }

    if (
        lower.includes("lazyload") ||
        lower.includes("lazy load") ||
        lower.includes("download js") ||
        lower.includes("download javascript") ||
        lower.includes("grab js") ||
        lower.includes("fetch js")
    ) {
        return { action: "lazyload", url };
    }

    // Stricter word-boundary check so "pentest" (which contains "test") doesn't
    // accidentally match the test/run heuristic when no pentest skill is loaded.
    if (url && /\b(scan|run|check|test)\b/.test(lower)) {
        return { action: "run", url };
    }

    return { action: "chat", url };
};

/**
 * Executes a tool based on detected intent.
 * For lazyload/run: spawns a child process job and returns IMMEDIATELY.
 * For parse_*: synchronous filesystem inspection.
 * For skill: renders the skill body for the LLM to consume as context.
 */
/**
 * Build the argv that would be passed to `node build/index.js <tool> ...` for a tool spawn.
 * `inputs` may carry a `url` (lazyload/run targets); other knobs default from `session.config`.
 */
const buildToolArgv = (
    tool: "run" | "lazyload",
    session: IntentToolState,
    inputs: { url?: string }
): string[] | null => {
    const url = inputs.url;
    if (!url) return null;
    const outputDir = session.config.default_output_dir || "output";
    const threads = session.config.default_threads || 1;
    if (tool === "lazyload") {
        return ["-u", url, "-o", outputDir, "-t", String(threads), "-y"];
    }
    return ["-u", url, "-o", outputDir, "-t", String(threads), "-y", "-k"];
};

const spawnTool = (
    tool: "run" | "lazyload",
    session: IntentToolState,
    inputs: { url?: string }
): { msg: string } | null => {
    const argv = buildToolArgv(tool, session, inputs);
    if (!argv) return null;
    const cwd = session.cwd;
    const job = getJobManager().startJob(tool, argv, cwd);
    session.lastModule = tool;
    session.lastOutputDir = path.resolve(cwd, session.config.default_output_dir || "output");
    return {
        msg: `[Job ${job.id}] ${tool} started in background (cwd: ${cwd}, target: ${inputs.url}). Ask for progress or use /jobs, /tail ${job.id}, /cancel ${job.id}.`,
    };
};

/**
 * Resolve `<param>` placeholders inside skill pre_action args using the supplied skill args.
 */
const resolvePreActionArgs = (preAction: SkillPreAction, skillArgs: Record<string, string>): { url?: string } => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(preAction.args)) {
        let resolved = v;
        for (const [pk, pv] of Object.entries(skillArgs)) {
            resolved = resolved.split(`<${pk}>`).join(pv);
        }
        out[k] = resolved;
    }
    return { url: out.url };
};

export const handleToolExecution = async (session: IntentToolState, intent: Intent): Promise<string | null> => {
    const { action, url } = intent;
    const cwd = session.cwd;

    switch (action) {
        case "lazyload": {
            const spawned = spawnTool("lazyload", session, { url });
            if (!spawned) return null;
            session.lastToolOutput = spawned.msg;
            return spawned.msg;
        }
        case "run": {
            const spawned = spawnTool("run", session, { url });
            if (!spawned) return null;
            session.lastToolOutput = spawned.msg;
            return spawned.msg;
        }
        case "parse_lazyload": {
            const dir = session.lastOutputDir || path.resolve(cwd, session.config.default_output_dir || "output");
            const summary = summarizeLazyloadOutput(dir);
            session.lastToolOutput = summary;
            return summary;
        }
        case "parse_run": {
            const summary = summarizeRunOutput(cwd);
            session.lastToolOutput = summary;
            return summary;
        }
        case "skill": {
            const name = intent.skillName!;
            const skill = findSkill(name);
            if (!skill) return `[!] Skill not found: ${name}`;
            const skillArgs = intent.skillArgs || {};
            const rendered = renderSkill(skill, skillArgs);
            if (!rendered.ok) return `[!] ${rendered.error}`;

            // Fire pre_actions (e.g. a `run` job) before the LLM consumes the skill body.
            const preLines: string[] = [];
            for (const action of skill.preActions) {
                const inputs = resolvePreActionArgs(action, skillArgs);
                const spawned = spawnTool(action.tool, session, inputs);
                if (spawned) preLines.push(spawned.msg);
                else preLines.push(`[!] pre_action ${action.tool} skipped (missing url)`);
            }
            const preBlock = preLines.length > 0 ? preLines.join("\n") + "\n\n" : "";
            const msg = `[Invoking skill: ${name}]\n${preBlock}${rendered.prompt}`;
            session.lastToolOutput = msg;
            return msg;
        }
        default:
            return null;
    }
};
