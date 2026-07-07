import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import csMastSEngine from "../../analyze/engine/csMastSEngine.js";
import type { Rule } from "../../analyze/types/index.js";
import type { Chunks } from "../../utility/interfaces.js";

// Real chunk from react/vuln_app Vite build — contains the dangerouslySetInnerHTML sink.
const CHUNK_FILE = path.resolve(__dirname, "../../../../js-recon-research/react/vuln_app/dist/assets/Post-Ck0sG56A.js");

// scat=name,id signature for the dangerouslySetInnerHTML.__html sink in the Post component.
// Generated during issue #25 experiment (FP=0 within the parent chunk).
const DSIH_SIG =
    "$v=1$hash=sha256,lang=js,prsr=-babel/parser,scat=name_id$1a572a605f850b1396d0d0950ba1f5c2c2d9f65eebb2fca04ce8f167e32b0c68";

// A syntactically valid PHC string with a random hash that should never match.
const NONEXISTENT_SIG =
    "$v=1$hash=sha256,lang=js,prsr=-babel/parser,scat=name_id$0000000000000000000000000000000000000000000000000000000000000000";

function makeChunks(code: string): Chunks {
    return {
        "Post-Ck0sG56A": {
            id: "Post-Ck0sG56A",
            description: "",
            loadedOn: [],
            containsFetch: true,
            isAxiosLibrary: false,
            exports: [],
            callStack: [],
            code,
            imports: [],
            file: "Post-Ck0sG56A.js",
        },
    };
}

function makeRule(signature: string): Rule {
    return {
        id: "test_cs_mast_s",
        name: "Test CS-MAST-S",
        author: "test",
        description: "unit test",
        js_recon_version: ">=1.4.1",
        tech: ["react"],
        severity: "high",
        type: "cs-mast-s",
        steps: [
            {
                name: "match_sink",
                message: "sink matched",
                csMastS: { signature },
            },
        ],
    };
}

describe("csMastSEngine", () => {
    const chunkExists = fs.existsSync(CHUNK_FILE);

    it("finds a known signature in the Post chunk", async () => {
        if (!chunkExists) {
            console.warn("Skipping: Post chunk not found at", CHUNK_FILE);
            return;
        }
        const code = fs.readFileSync(CHUNK_FILE, "utf-8");
        const findings = await csMastSEngine(makeRule(DSIH_SIG), makeChunks(code));
        expect(findings.length).toBe(1);
        expect(findings[0].ruleId).toBe("test_cs_mast_s");
        expect(findings[0].findingLocation).toContain(DSIH_SIG);
    });

    it("returns no findings for a signature that does not exist", async () => {
        if (!chunkExists) {
            console.warn("Skipping: Post chunk not found at", CHUNK_FILE);
            return;
        }
        const code = fs.readFileSync(CHUNK_FILE, "utf-8");
        const findings = await csMastSEngine(makeRule(NONEXISTENT_SIG), makeChunks(code));
        expect(findings.length).toBe(0);
    });

    it("returns no findings for an invalid (non-PHC) signature string", async () => {
        if (!chunkExists) {
            console.warn("Skipping: Post chunk not found at", CHUNK_FILE);
            return;
        }
        const code = fs.readFileSync(CHUNK_FILE, "utf-8");
        const findings = await csMastSEngine(makeRule("not-a-valid-sig"), makeChunks(code));
        expect(findings.length).toBe(0);
    });

    it("returns no findings for an empty chunk", async () => {
        const findings = await csMastSEngine(makeRule(DSIH_SIG), makeChunks(""));
        expect(findings.length).toBe(0);
    });

    it("returns no findings for unparseable JS", async () => {
        const findings = await csMastSEngine(makeRule(DSIH_SIG), makeChunks("{{{{ not valid JS >><< "));
        expect(findings.length).toBe(0);
    });

    it("requires chain: fires only when required step also matches", async () => {
        if (!chunkExists) {
            console.warn("Skipping: Post chunk not found at", CHUNK_FILE);
            return;
        }
        const code = fs.readFileSync(CHUNK_FILE, "utf-8");
        const rule: Rule = {
            id: "test_requires",
            name: "Test requires",
            author: "test",
            description: "unit test",
            js_recon_version: ">=1.4.1",
            tech: ["react"],
            severity: "high",
            type: "cs-mast-s",
            steps: [
                {
                    name: "step_a",
                    message: "step a matched",
                    csMastS: { signature: DSIH_SIG },
                },
                {
                    name: "step_b",
                    message: "step b matched — requires step_a",
                    requires: ["step_a"],
                    csMastS: { signature: NONEXISTENT_SIG },
                },
            ],
        };
        const findings = await csMastSEngine(rule, makeChunks(code));
        // step_a matches but step_b doesn't → 2 steps declared, only 1 completed → no finding
        expect(findings.length).toBe(0);
    });
});
