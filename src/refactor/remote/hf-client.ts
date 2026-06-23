// HuggingFace dataset client for CS-MAST-S signature retrieval.
// All remote interaction is isolated here so the storage backend can be swapped
// without touching the rest of the refactor pipeline.

export const HF_DATASET = "shriyanss/cs-mast-s-dataset";

// Maps refactor tech identifier to the HuggingFace dataset branch that holds its signatures.
export const TECH_TO_BRANCH: Record<string, string> = {
    "react-webpack": "react-small",
};

export type CollisionRecord = {
    signature: string;
    count: number;
    files: string[];
};

type HfTreeEntry = {
    type: "file" | "directory";
    path: string;
    size?: number;
};

// --- URL builders ---

export const getHfRawUrl = (branch: string, subpath: string): string =>
    `https://huggingface.co/datasets/${HF_DATASET}/raw/${branch}/${subpath}`;

export const getHfApiTreeUrl = (branch: string, subdir?: string): string => {
    const base = `https://huggingface.co/api/datasets/${HF_DATASET}/tree/${branch}`;
    return subdir ? `${base}/${subdir}` : base;
};

// --- Low-level fetch helpers ---

// Returns the response text, or null on 404 / non-OK responses.
// Throws on HTTP 429 (rate limit) so callers can surface the error.
export const fetchText = async (url: string): Promise<string | null> => {
    let resp: Response;
    try {
        resp = await fetch(url);
    } catch (e) {
        return null;
    }
    if (resp.status === 429) throw new Error(`Rate limited by HuggingFace (url: ${url})`);
    if (!resp.ok) return null;
    return resp.text();
};

// --- Branch metadata ---

export const getSampleSize = async (branch: string): Promise<number> => {
    const text = await fetchText(getHfRawUrl(branch, "sample_size"));
    if (text === null) throw new Error(`Branch "${branch}": could not fetch sample_size`);
    const n = parseInt(text.trim(), 10);
    if (isNaN(n)) throw new Error(`Branch "${branch}": sample_size is not a number ("${text.trim()}")`);
    return n;
};

export const getTechnology = async (branch: string): Promise<string> => {
    const text = await fetchText(getHfRawUrl(branch, "technology"));
    if (text === null) throw new Error(`Branch "${branch}": could not fetch technology`);
    return text.trim();
};

// Validates that the remote branch has the required metadata files.
// Returns true when valid, false when either file is missing/unreachable.
export const validateRemoteBranch = async (branch: string): Promise<boolean> => {
    const [sampleSizeText, technologyText] = await Promise.all([
        fetchText(getHfRawUrl(branch, "sample_size")),
        fetchText(getHfRawUrl(branch, "technology")),
    ]);
    return sampleSizeText !== null && technologyText !== null;
};

// --- File listing ---

// Lists feature subdirectory names at the top level of a branch (non-recursive).
const listTopLevelDirs = async (branch: string): Promise<string[]> => {
    const text = await fetchText(getHfApiTreeUrl(branch));
    if (text === null) return [];
    try {
        const entries = JSON.parse(text) as HfTreeEntry[];
        return entries.filter((e) => e.type === "directory").map((e) => e.path);
    } catch {
        return [];
    }
};

// Returns relative paths of all collisions.json files under `<featureDir>/<scatDir>/collisions.json`
// for every top-level feature directory in the branch. Does NOT require recursive tree traversal.
export const listCollisionsFiles = async (branch: string, scatDir: string): Promise<string[]> => {
    const featureDirs = await listTopLevelDirs(branch);
    return featureDirs.map((dir) => `${dir}/${scatDir}/collisions.json`);
};

// Fetches and parses a collisions.json from a raw HF URL.
// Returns null on 404 / non-OK; throws on rate limit.
export const fetchCollisionsJson = async (url: string): Promise<CollisionRecord[] | null> => {
    const text = await fetchText(url);
    if (text === null) return null;
    try {
        return JSON.parse(text) as CollisionRecord[];
    } catch {
        return null;
    }
};
