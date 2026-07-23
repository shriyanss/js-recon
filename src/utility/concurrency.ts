/**
 * Runs `worker` over `items` using up to `threads` concurrent workers.
 * Each worker pulls the next unclaimed item off a shared cursor, so
 * uneven per-item latency doesn't leave workers idle.
 */
export const runWithConcurrency = async <T>(
    items: T[],
    threads: number,
    worker: (item: T, index: number) => Promise<void>
): Promise<void> => {
    if (items.length === 0) return;

    let cursor = 0;
    const workerCount = Math.max(1, Math.min(threads, items.length));

    const runWorker = async () => {
        while (cursor < items.length) {
            const index = cursor++;
            await worker(items[index], index);
        }
    };

    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
};
