import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { fileURLToPath } from "url";
import path from "path";

const RING_BUFFER_CAP = 16 * 1024;

export type JobStatus = "running" | "done" | "failed" | "cancelled";

export interface JobSummary {
    id: number;
    name: string;
    args: string[];
    status: JobStatus;
    startedAt: number;
    endedAt?: number;
    elapsedMs: number;
    exitCode: number | null;
    cwd: string;
}

interface RingBuffer {
    chunks: string;
    push(s: string): void;
    tail(n: number): string;
}

const createRingBuffer = (cap: number): RingBuffer => {
    const rb: RingBuffer = {
        chunks: "",
        push(s: string) {
            this.chunks += s;
            if (this.chunks.length > cap) {
                this.chunks = this.chunks.slice(this.chunks.length - cap);
            }
        },
        tail(n: number) {
            if (n >= this.chunks.length) return this.chunks;
            return this.chunks.slice(this.chunks.length - n);
        },
    };
    return rb;
};

interface JobInternal {
    id: number;
    name: string;
    args: string[];
    cwd: string;
    startedAt: number;
    endedAt?: number;
    status: JobStatus;
    exitCode: number | null;
    child: ChildProcess;
    buffer: RingBuffer;
    donePromise: Promise<void>;
}

const findRepoEntry = (): string => {
    // jobs.ts is at build/mcp/jobs.js; entry is build/index.js
    return fileURLToPath(new URL("../index.js", import.meta.url));
};

class JobManager extends EventEmitter {
    private jobs = new Map<number, JobInternal>();
    private nextId = 1;

    startJob(name: string, args: string[], cwd: string): JobSummary {
        const id = this.nextId++;
        const entry = findRepoEntry();
        const buffer = createRingBuffer(RING_BUFFER_CAP);

        const child = spawn(process.execPath, ["--max-old-space-size=8192", entry, name, ...args], {
            cwd,
            env: process.env,
            stdio: ["ignore", "pipe", "pipe"],
        });

        const stamp = (chunk: Buffer | string): void => {
            buffer.push(chunk.toString());
        };
        child.stdout?.on("data", stamp);
        child.stderr?.on("data", stamp);

        const internal: JobInternal = {
            id,
            name,
            args,
            cwd,
            startedAt: Date.now(),
            status: "running",
            exitCode: null,
            child,
            buffer,
            donePromise: new Promise<void>((resolve) => {
                child.on("close", (code, signal) => {
                    internal.endedAt = Date.now();
                    internal.exitCode = code;
                    if (internal.status === "cancelled") {
                        // already set
                    } else if (signal === "SIGTERM" || signal === "SIGKILL") {
                        internal.status = "cancelled";
                    } else if (code === 0) {
                        internal.status = "done";
                    } else {
                        internal.status = "failed";
                    }
                    this.emit("done", this.toSummary(internal));
                    resolve();
                });
                child.on("error", (err) => {
                    buffer.push(`\n[spawn error] ${err.message}\n`);
                });
            }),
        };
        this.jobs.set(id, internal);
        return this.toSummary(internal);
    }

    private toSummary(j: JobInternal): JobSummary {
        const endedAt = j.endedAt;
        const elapsedMs = (endedAt || Date.now()) - j.startedAt;
        return {
            id: j.id,
            name: j.name,
            args: j.args,
            status: j.status,
            startedAt: j.startedAt,
            endedAt,
            elapsedMs,
            exitCode: j.exitCode,
            cwd: j.cwd,
        };
    }

    getJob(id: number): JobSummary | undefined {
        const j = this.jobs.get(id);
        return j ? this.toSummary(j) : undefined;
    }

    listJobs(): JobSummary[] {
        return Array.from(this.jobs.values()).map((j) => this.toSummary(j));
    }

    listRunning(): JobSummary[] {
        return this.listJobs().filter((j) => j.status === "running");
    }

    tailJob(id: number, n = 2048): string | undefined {
        const j = this.jobs.get(id);
        if (!j) return undefined;
        return j.buffer.tail(n);
    }

    fullLog(id: number): string | undefined {
        const j = this.jobs.get(id);
        return j?.buffer.chunks;
    }

    async waitJob(id: number): Promise<JobSummary | undefined> {
        const j = this.jobs.get(id);
        if (!j) return undefined;
        await j.donePromise;
        return this.toSummary(j);
    }

    cancelJob(id: number): boolean {
        const j = this.jobs.get(id);
        if (!j || j.status !== "running") return false;
        j.status = "cancelled";
        try {
            j.child.kill("SIGTERM");
        } catch {
            // ignore
        }
        const killTimer = setTimeout(() => {
            try {
                if (!j.child.killed) j.child.kill("SIGKILL");
            } catch {
                // ignore
            }
        }, 3000);
        j.child.on("close", () => clearTimeout(killTimer));
        return true;
    }

    cancelMostRecentRunning(): JobSummary | undefined {
        const running = this.listRunning();
        if (running.length === 0) return undefined;
        const latest = running.sort((a, b) => b.startedAt - a.startedAt)[0];
        if (this.cancelJob(latest.id)) return latest;
        return undefined;
    }
}

let singleton: JobManager | null = null;

export const getJobManager = (): JobManager => {
    if (!singleton) singleton = new JobManager();
    return singleton;
};

export const buildJobContext = (n = 2048): string => {
    const mgr = getJobManager();
    const running = mgr.listRunning();
    if (running.length === 0) return "";
    const parts: string[] = [];
    for (const j of running) {
        const tail = mgr.tailJob(j.id, n) || "";
        const elapsed = Math.round(j.elapsedMs / 1000);
        parts.push(
            `\n\n[Job ${j.id} (${j.name}) — running ${elapsed}s, recent output]:\n${tail || "(no output yet)"}`
        );
    }
    return parts.join("");
};

export const formatJobsTable = (): string => {
    const jobs = getJobManager().listJobs();
    if (jobs.length === 0) return "No jobs.";
    const rows = jobs.map((j) => {
        const elapsed = Math.round(j.elapsedMs / 1000);
        return `  #${j.id}  ${j.status.padEnd(10)} ${j.name.padEnd(10)} ${elapsed}s  exit=${
            j.exitCode === null ? "-" : j.exitCode
        }  ${j.args.join(" ")}`;
    });
    return rows.join("\n");
};
