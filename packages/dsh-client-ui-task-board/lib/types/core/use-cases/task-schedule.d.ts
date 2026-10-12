import { type ScheduleMode, type ScheduleStopReason, type TaskRecord } from '../tasks.ts';
/** Fields the schedule use case may change on a rule. */
export interface SetSchedulePatch {
    enabled?: boolean;
    /** Which kind of plan to write; an absent key keeps the current mode. */
    mode?: ScheduleMode;
    /** 5-field cron expression of a recurring rule. */
    cron?: string;
    /** Planned instant of a one-shot rule (ms epoch). */
    at?: number;
    /** IANA zone for the wall clock; `null` clears it back to the Host zone. */
    timeZone?: string | null;
    /** Run cap of a recurring rule; `null` clears it back to unlimited. */
    maxRuns?: number | null;
}
/** Result of arming/disarming a rule. */
export interface SetScheduleResult {
    /** The next ledger; unchanged reference when rejected. */
    tasks: readonly TaskRecord[];
    /** Whether the rule was applied (false on unknown task / invalid plan). */
    applied: boolean;
}
/**
 * Set an on-board task's scheduling rule. An unknown or archived task, an
 * unusable zone, a blank or invalid cron, a one-shot with no usable instant,
 * a one-shot armed in the past, and a run cap that is not a positive integer
 * are all rejected (state untouched). An enabled rule computes its next run
 * instant immediately — a one-shot's next instant IS its planned instant — and
 * a disabled rule carries none.
 *
 * Arming a rule that was not enabled, or switching its kind, starts a fresh
 * budget: the run counter and any previous stop/skip record are cleared. Edits
 * to a live rule (expression, zone, cap) keep the consumed count, so an
 * already-spent budget can never silently reset and overrun.
 * @param tasks - current ledger.
 * @param id - the task to schedule.
 * @param patch - rule fields to change (absent fields keep their current value).
 * @param now - clock instant (ms epoch).
 * @param hostTimeZone - zone a rule with no stored zone follows.
 */
export declare function applySetSchedule(tasks: readonly TaskRecord[], id: string, patch: SetSchedulePatch, now: number, hostTimeZone: string): SetScheduleResult;
/**
 * Roll a task's schedule rule forward (legacy pure-controller seam): persist
 * the next due instant and the trigger instant. No-op for tasks without a rule.
 * @param tasks - current ledger.
 * @param id - the task to roll forward.
 * @param nextRunAt - next due instant (may be undefined to clear).
 * @param lastTriggeredAt - the trigger instant of this run.
 * @param now - clock instant (ms epoch).
 */
export declare function applyScheduleNextRun(tasks: readonly TaskRecord[], id: string, nextRunAt: number | undefined, lastTriggeredAt: number | undefined, now: number): readonly TaskRecord[];
/**
 * The effect one due occurrence has on its rule, applied by the Host ledger.
 */
export interface ScheduleProgress {
    /** Executions this occurrence actually opened (0 or 1), added to the counter. */
    consumed: number;
    /** Next due instant; absent stops the rule. */
    nextRunAt?: number;
    /** Trigger instant recorded as `lastTriggeredAt` (a consumed run only). */
    lastTriggeredAt?: number;
    /** Terminal reason when the rule stops itself (disarms it). */
    endedReason?: ScheduleStopReason;
    /** Why this occurrence produced no run, when it did not. */
    skippedReason?: ScheduleStopReason;
}
/**
 * Refund the one scheduled run an occurrence consumed before its launch failed
 * without ever creating a session. Nothing ran, so the run budget is restored
 * and the rule is left able to serve its next occurrence — a launch failure
 * must never silently spend the user's limited budget.
 *
 * A recurring rule keeps its already-rolled-forward target; a fire that ended
 * the rule at its cap (no target left) is restored and re-armed at the next
 * occurrence, so a failed launch consumes nothing. A one-shot has no later
 * occurrence, so it is left stopped with `launch-failed` and its run returned.
 * A rule the user disabled in the meantime is not resurrected.
 * @param tasks - current ledger.
 * @param id - the task whose occurrence is being refunded.
 * @param now - clock instant (ms epoch).
 * @param hostTimeZone - zone a rule with no stored zone follows.
 * @returns the next ledger.
 */
export declare function applyScheduleRefund(tasks: readonly TaskRecord[], id: string, now: number, hostTimeZone: string): readonly TaskRecord[];
/**
 * Record what a due occurrence did to a task's rule: advance the run counter
 * by the executions it opened, set the next target (or stop the rule), and
 * note a terminal reason or a skipped occurrence. Nothing is written for a
 * task that has no rule or has been archived mid-tick.
 * @param tasks - current ledger.
 * @param id - the task whose rule fired.
 * @param progress - the occurrence's effect.
 * @param now - clock instant (ms epoch).
 * @returns the next ledger.
 */
export declare function applyScheduleProgress(tasks: readonly TaskRecord[], id: string, progress: ScheduleProgress, now: number): readonly TaskRecord[];
