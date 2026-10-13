/**
 * Poll-loop guard shared by the plugin family's Host halves (git-graph,
 * task-board): one bounded refresh loop that never overlaps itself,
 * backs off on consecutive failures, and stops at a global deadline. Pure
 * logic with injectable timers, so consumers test it without wall clocks.
 */
const DEFAULT_TIMERS = {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (handle) => { clearTimeout(handle); },
};
/**
 * Owns one bounded poll loop.
 *
 * Guarantees: at most one task runs at a time (a scheduled tick whose turn
 * arrives while a run is in flight is dropped); consecutive failures double
 * the delay up to maxBackoffMs and reset on the first success; the loop
 * stops forever at deadlineMs and cancels its timer.
 */
export class PollGuard {
    options;
    handle;
    running = false;
    startedAt = 0;
    stopped = false;
    failures = 0;
    /** @param options - loop bounds; interval/deadline/backoff/onRun are required, the rest optional. */
    constructor(options) {
        this.options = {
            timers: DEFAULT_TIMERS,
            onDeadline: () => { },
            onSettled: () => { },
            ...options,
        };
    }
    /** Start the loop. Safe to call once; later calls are ignored. */
    start() {
        if (this.startedAt !== 0)
            return;
        this.startedAt = Date.now();
        this.schedule(this.options.intervalMs);
    }
    /** Stop the loop permanently and drop any pending tick. */
    stop() {
        this.stopped = true;
        this.options.timers.clear(this.handle);
        this.handle = undefined;
    }
    schedule(delayMs) {
        if (this.stopped)
            return;
        this.handle = this.options.timers.set(() => { void this.tick(); }, delayMs);
    }
    delay() {
        const backoff = this.options.intervalMs * 2 ** Math.min(this.failures, 8);
        return Math.min(backoff, this.options.maxBackoffMs);
    }
    async tick() {
        if (this.stopped)
            return;
        if (this.running)
            return; // Anti-overlap: drop ticks that arrive mid-run.
        if (Date.now() - this.startedAt >= this.options.deadlineMs) {
            this.stopped = true;
            this.options.onDeadline();
            return;
        }
        this.running = true;
        try {
            await this.options.onRun();
            this.failures = 0;
        }
        catch {
            this.failures += 1;
        }
        finally {
            this.running = false;
            this.options.onSettled(this.failures);
            this.schedule(this.delay());
        }
    }
}
