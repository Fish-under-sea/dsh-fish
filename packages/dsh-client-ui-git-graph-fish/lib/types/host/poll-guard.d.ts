/**
 * Poll-loop guard shared by the plugin family's Host halves (git-graph,
 * task-board): one bounded refresh loop that never overlaps itself,
 * backs off on consecutive failures, and stops at a global deadline. Pure
 * logic with injectable timers, so consumers test it without wall clocks.
 */
/** Timer injection seam; defaults to the global setTimeout/clearTimeout pair. */
export interface PollTimers {
    /** Schedule fn(ms). */
    set: (fn: () => void, ms: number) => unknown;
    /** Cancel a scheduled handle. */
    clear: (handle: unknown) => void;
}
export interface PollGuardOptions {
    /** Base interval between runs. */
    intervalMs: number;
    /** Runs stop entirely once this much wall time passed since start(). */
    deadlineMs: number;
    /** Cap for the failure backoff; each consecutive failure doubles the delay up to this. */
    maxBackoffMs: number;
    /** Optional timer seam for tests. */
    timers?: PollTimers;
    /** Invoked once when the deadline fires; no run starts afterwards. */
    onDeadline?: () => void;
    /** Invoked after a run settles with the consecutive-failure count. */
    onSettled?: (consecutiveFailures: number) => void;
    /** The task each tick runs; a rejection counts as a failure. */
    onRun: () => Promise<void>;
}
/**
 * Owns one bounded poll loop.
 *
 * Guarantees: at most one task runs at a time (a scheduled tick whose turn
 * arrives while a run is in flight is dropped); consecutive failures double
 * the delay up to maxBackoffMs and reset on the first success; the loop
 * stops forever at deadlineMs and cancels its timer.
 */
export declare class PollGuard {
    private readonly options;
    private handle;
    private running;
    private startedAt;
    private stopped;
    private failures;
    /** @param options - loop bounds; interval/deadline/backoff/onRun are required, the rest optional. */
    constructor(options: PollGuardOptions);
    /** Start the loop. Safe to call once; later calls are ignored. */
    start(): void;
    /** Stop the loop permanently and drop any pending tick. */
    stop(): void;
    private schedule;
    private delay;
    private tick;
}
//# sourceMappingURL=poll-guard.d.ts.map