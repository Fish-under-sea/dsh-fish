import { type ExecutionOutcome, type ExecutionRecord, type ScheduleMode, type TaskRecord } from './core/tasks.ts';
import { type TaskBoardAction, type TaskBoardSchedulerSnapshot } from './protocol.ts';
import { type ExecutionVerification } from './core/verification.ts';
import { type TaskPermission } from './core/handover.ts';
export interface LedgerState {
    revision: number;
    tasks: TaskRecord[];
    scheduler: TaskBoardSchedulerSnapshot;
}
export interface OpenedRun {
    task: TaskRecord;
    execution: ExecutionRecord;
    /**
     * How the Host obtains this run's session. Absent or `session` launches a
     * fresh (or reused) execution session; `teammate` means the run belongs to a
     * team-mode cascade, where the Host asks the root's Lead session to spawn a
     * teammate instead of launching a session of its own.
     */
    dispatch?: 'session' | 'teammate';
}
/** Minimal value copy used by the Host session monitor. */
export interface OpenExecutionReference {
    readonly taskId: string;
    readonly executionId: string;
    readonly sessionId: string | undefined;
    readonly startedAt: number;
    /**
     * True for a member of a team-mode run other than its Lead. A teammate is a
     * durable member of the Team: it stays alive after its turn ends, so the
     * roster may keep reporting its session as running, and the turn it completed
     * is the only verdict it exposes.
     */
    readonly teamMember: boolean;
}
/** Minimal value copy used by the Host scheduler. */
export interface DueScheduleReference {
    readonly taskId: string;
    /** Whether this due rule is a recurring cron rule or a single planned instant. */
    readonly mode: ScheduleMode;
    /** Cron expression of a recurring rule; absent on a one-shot. */
    readonly cron?: string;
    /** Zone this rule's wall clock is read in. */
    readonly timeZone: string;
    readonly nextRunAt: number;
}
/** Derived runtime data for one session-poll pass. */
export interface LedgerRuntimeView {
    readonly armedSchedules: number;
    readonly openExecutions: readonly OpenExecutionReference[];
    /**
     * Session ids of every open execution, including the ones
     * {@link openExecutions} skips because their own outcome is already
     * recorded. A caller that asks whether the board still observes any session
     * must use this list: a deferred cascade parent is settled by its members,
     * but it is still an open execution.
     */
    readonly openSessionIds: readonly string[];
    /**
     * Whether this document holds anything the session roster can still decide:
     * an open execution that needs inspecting, or a card in the running column
     * whose verdict may arrive from a settle this process never saw.
     *
     * A board with no running card, no open execution and no armed schedule has
     * no use for the roster at all, which is what lets the Host poll stand down
     * instead of re-reading every persisted session forever.
     */
    readonly needsSessionState: boolean;
}
/**
 * Best-effort single-letter process state ('R','S','D','Z',...) or undefined
 * when no probe is available on this platform. Linux reads /proc/<pid>/stat
 * directly (no subprocess); other POSIX shells out to `ps -o stat=`; Windows
 * has no zombie state, so it returns undefined and the kill(0) probe alone
 * is authoritative there.
 */
export declare function processState(pid: number): string | undefined;
export declare function processIsAlive(pid: number): boolean;
/** Runs one PowerShell script and returns its trimmed stdout. */
export type PowerShellProbe = (script: string, timeoutMs: number) => string | undefined;
/**
 * Windows start time (Unix epoch ms) of a live process.
 *
 * `Get-Process` is the precise first choice, but an unprivileged caller cannot
 * read `.StartTime` for a protected process (System, svchost): the property is
 * empty, so the probe returns nothing. Without a fallback, a crash leftover
 * lock whose PID was reused by such a process could never be proven stale and
 * blocked every startup until the lock was deleted by hand (issue #1629).
 * Win32_Process through CIM reports the same CreationDate for those processes
 * at the same millisecond precision, so it is the second identity source. The
 * probe is injectable so the fallback chain is testable off Windows.
 */
export declare function win32StartTimeMs(pid: number, probe?: PowerShellProbe): number | undefined;
/**
 * Repair parent links after a load or an import: a link whose parent row is
 * missing, cyclic, or names an archived parent while the child is on board is
 * dropped (the task becomes a root) instead of dropping the task. A chain
 * deeper than the current `maxSubtaskDepth` is deliberately KEPT: the limit
 * gates new links, it never deletes a stored one, and every cascade walk is
 * bounded by the limit anyway. The Host is the only writer of these links, so
 * this is a last-resort guard against a hand-edited or imported document.
 */
export declare function repairParentLinks(tasks: readonly TaskRecord[]): TaskRecord[];
export declare class HostTaskLedger {
    private readonly now;
    private document;
    private readonly listeners;
    private readonly requestCache;
    private readonly lockToken;
    private lockFd;
    readonly file: string;
    readonly lockFile: string;
    /** Small sidecar for the 30 s scheduler heartbeat (lastTickAt only). */
    readonly schedulerFile: string;
    /** Resolves the baseline the confirmation gate compares a binding against. */
    private readonly sessionDefault;
    /**
     * Session-default permission the confirmation gate compares against. Read
     * through the resolver on every use, so a baseline that follows the Host's
     * own default preset tracks a Settings change made while the board runs.
     */
    get sessionDefaultPermission(): TaskPermission;
    /**
     * Deployment subtask depth limit (1..3): the lineage gate every write obeys.
     * The settings card edits it live, so {@link setMaxSubtaskDepth} mutates it
     * instead of remounting the row.
     */
    private depthLimit;
    constructor(dir?: string, now?: () => number, options?: {
        sessionDefaultPermission?: TaskPermission | (() => TaskPermission);
        maxSubtaskDepth?: number;
    });
    /** Current subtask depth limit (1..3). */
    get maxSubtaskDepth(): number;
    /**
     * Apply a live settings edit of the subtask depth limit. A no-op when the
     * normalized limit is unchanged, so a coarse volatile invalidation that
     * changed nothing emits nothing.
     */
    setMaxSubtaskDepth(depth: number): void;
    /** Remove leftover *.tmp-* files from previous crashes or interrupted writes. */
    private cleanStaleTemporaryFiles;
    /** Revision + scheduler without any task cloning; feeds the SSE event frame. */
    summary(): {
        revision: number;
        scheduler: TaskBoardSchedulerSnapshot;
    };
    state(): LedgerState;
    /**
     * Runtime-only projection for the Host poll. It copies just primitive
     * identifiers and timestamps, never the complete task/execution history or
     * an authoritative mutable object from the ledger.
     */
    runtimeView(): LedgerRuntimeView;
    /** Count armed, non-archived schedules without cloning task histories. */
    armedScheduleCount(): number;
    /**
     * The earliest armed `nextRunAt` strictly after the supplied Host time, or
     * undefined when no schedule is armed in the future. This is the instant the
     * Host arms its native timer at, so the board wakes exactly when work is due
     * instead of polling a fixed heartbeat.
     * @param now - current Host time in ms epoch.
     * @returns the nearest future trigger, or undefined when none is armed.
     */
    nextArmedRunAt(now: number): number | undefined;
    /** Return value-only references for schedules due at the supplied Host time. */
    dueSchedules(now: number): DueScheduleReference[];
    subscribe(listener: () => void): () => void;
    dispose(): void;
    applyRequest(requestId: string, action: TaskBoardAction, initiator?: string): {
        state: LedgerState;
        runs?: OpenedRun[];
    };
    /**
     * Open the cascade one due schedule triggers: an empty array means nothing
     * ran (already running, or a participant whose elevated permission is still
     * unconfirmed, a one-shot whose instant was missed, or an exhausted budget),
     * and the rule's own state says which.
     *
     * The run budget is enforced HERE, inside the single ledger writer: a rule
     * whose counter already reached its cap is stopped instead of opened, so no
     * restart, repeated timer fire or re-arm can overrun it.
     * @param taskId - the task whose rule came due.
     * @param triggeredAt - the instant the occurrence came due.
     * @returns the executions this occurrence opened.
     */
    openScheduled(taskId: string, triggeredAt: number): OpenedRun[];
    /**
     * Record a due occurrence that opened no execution: roll a recurring rule to
     * its next occurrence (budget untouched), or stop it when there is none. A
     * one-shot has no second occurrence, so it always stops here with the reason.
     */
    private skipOccurrence;
    /** Apply a schedule-occurrence transition and persist it atomically. */
    private progressSchedule;
    /**
     * Refund the one scheduled run an occurrence consumed before its launch
     * failed without creating a session (see
     * {@link applyScheduleRefund}). Called by the service on the failed-launch
     * path only; a manual run and a launch that did reach a session are never
     * refunded. A no-op for a task with no rule, so a failed cascade member does
     * not touch anything.
     * @param taskId - the task whose occurrence is being refunded.
     * @param now - clock instant (ms epoch).
     */
    refundScheduledOccurrence(taskId: string, now: number): void;
    /**
     * Boot / resume recovery: skip every occurrence that came due while the board
     * was not running through it. A recurring rule rolls to its next future
     * target; a one-shot whose instant has passed is stopped as missed, because
     * there is no later occurrence left to run. Rendering the missed occurrence
     * is deliberately not attempted: the ACL of a card that fired hours ago is
     * stale, and the board's own recovery contract is "missed triggers are
     * skipped, never replayed".
     */
    skipMissed(now: number): void;
    setScheduler(patch: Partial<TaskBoardSchedulerSnapshot>): void;
    /**
     * Settle one execution. A cascade participant first records its OWN outcome
     * and only finalizes once every child execution in its run group has
     * settled, so a parent card leaves 'running' with the whole tree's verdict
     * rather than its own turn alone.
     */
    settle(taskId: string, executionId: string, outcome: ExecutionOutcome, error?: string): void;
    attachSession(taskId: string, executionId: string, sessionId: string): void;
    allTasks(): readonly TaskRecord[];
    getTask(id: string): TaskRecord | undefined;
    saveTaskRecord(task: TaskRecord): void;
    private apply;
    /**
     * Whether a creation-time schedule request is usable. A one-shot must carry
     * a whole-millisecond instant in the future; a recurring rule must carry a
     * valid expression with a reachable occurrence and, when capped, a positive
     * whole run budget. An unusable zone is refused rather than reinterpreted as
     * the Host zone.
     */
    private validScheduleRequest;
    /**
     * The binding that makes a run illegal, if any.
     *
     * A plain cascade launches one session per participant, so every participant
     * carries its own resolved binding and each one gates the run. A team run
     * launches only the Lead session: the Lead's binding gates it, and a
     * teammate inherits that session's permission, so a subtask's OWN pin is
     * refused exactly when the Lead session does not already carry it — the
     * teammate could never be given that authority, and dropping the pin
     * silently would misreport the work (an inherited binding is the Lead's own
     * and stays allowed once the Lead is confirmed).
     * @param root - the task being run.
     * @returns the first refusal, or undefined when the run may start.
     */
    private bindingRefusal;
    /**
     * The tasks a cascade from `rootId` would actually open executions for, with
     * their effective execution targets resolved. Archived members never run, and
     * a member that already has an open execution is skipped (a task cannot run
     * twice), so the result is the participant set the launch will use.
     */
    private cascadeParticipants;
    /** Whether a task or any of its subtasks still has an open execution. */
    private subtreeHasOpenExecution;
    /**
     * Open one execution per cascade participant (the requested task and its
     * on-board descendants, within the depth limit) under a single run group, and
     * commit the ledger once. The returned runs are ordered root-first, so the
     * Host launches the parent before its subtasks.
     * @param root - the task the user ran.
     * @param now - clock instant (ms epoch).
     * @param initiator - the DSH session that asked for the run (audit only).
     * @param rerun - true to reset the root to 'todo' before starting it.
     * @param progress - when set, this run was a due occurrence and the root's
     *   rule is advanced (counter, next target, stop/skip record) in the same
     *   atomic commit that opened the executions.
     */
    private startCascade;
    /**
     * Finalize every cascade parent that is ready, walking from `taskId` up the
     * lineage: a member settles once its own outcome is recorded and none of its
     * group children is still open, and its verdict folds those children in
     * (failure dominates, then cancellation).
     */
    private settleCascade;
    /**
     * Close every run that is already decided, and fold every lineage whose
     * members are all settled. The Host poll calls this on every tick, so a run
     * can no longer be left in the running column by a settle nobody observed:
     *
     * - A team run is governed by its Lead. Once the Lead's own outcome is
     *   recorded, its still-open members are settled with that verdict. A
     *   teammate is a durable member of the Team and may never report a turn of
     *   its own, and without this the whole lineage waits on it forever.
     * - A cascade parent whose members are all settled is finalized here even
     *   when the settle that completed the tree happened in another process, or
     *   was interrupted between its child write and its parent write.
     *
     * Idempotent: a run that is already folded is left untouched, so a caller may
     * invoke it on every tick.
     * @param persist - false to leave the document for the caller to commit.
     * @returns whether the document changed.
     */
    finalizeReadyRuns(persist?: boolean): boolean;
    /**
     * The verdict a team run's Lead has already recorded: its own turn outcome
     * once that turn ended, or the folded outcome once its card settled.
     */
    private leadVerdict;
    /**
     * Settle every still-open member of a team run with the Lead's verdict.
     * A teammate that already reported its own outcome keeps it: the ordinary
     * fold still lets a failure dominate.
     * @param leadId - the Lead card's task id (never settled here).
     * @param groupId - the team run's group.
     * @param verdict - the Lead's outcome, inherited by members that never reported.
     * @param error - the Lead's failure text, inherited with a failed verdict.
     * @param now - clock instant (ms epoch).
     * @returns whether the document changed.
     */
    private closeTeamMembers;
    /**
     * Re-align every armed rule at load/import. A recurring rule is recomputed
     * from the current instant; a one-shot is armed at its planned instant when
     * that is still in the future, and stopped as missed once it has passed
     * (there is no later occurrence to run). A recurring rule recomputed past an
     * occurrence records the skip, so the board can show that a fire was passed
     * over rather than silently rewinding.
     */
    private repairSchedules;
    private reconcileInterruptedStarts;
    /**
     * Field-preserving migration of an older document. It first proves every task
     * row is structurally valid, so a document that would silently drop or coerce
     * rows fails loudly instead (no quarantined-empty restart), and then reuses
     * the current normalization.
     *
     * v4 adds `ScheduleRule.timeZone`. A rule written before v4 was evaluated in
     * whatever zone the Host process happened to report, so the migration stamps
     * that zone onto every enabled rule: the trigger instant is preserved exactly
     * (the stored `nextRunAt` already encodes the old zone), but the rule stops
     * following a later `TZ` change, which is what made an existing schedule
     * silently move when the Host's zone changed.
     *
     * v5 adds the per-execution acceptance block. The migration deliberately does
     * NOT stamp one: an execution opened before v5 keeps no contract, so it
     * settles on its own historical verdict and no in-flight run is retroactively
     * judged by a gate that was never armed for it.
     */
    private migrateLegacyDocument;
    /**
     * Find the still-open execution that ran in one session, with its task.
     *
     * The completion gate keys on the session id its tool call arrives from: the
     * execution record is the only object binding a session to a card, and an
     * already-settled execution is deliberately not returned (a session the board
     * no longer owns must not be gated).
     * @param sessionId - the DSH session the tool call runs in.
     * @returns the open execution and its task, or undefined.
     */
    findOpenExecutionBySession(sessionId: string): {
        task: TaskRecord;
        execution: ExecutionRecord;
    } | undefined;
    /**
     * Replace one execution's acceptance block (creating it when absent).
     *
     * A no-op when the serialized value is unchanged, so a coarse caller that
     * re-writes the same state never bumps the ledger revision. A settled
     * execution keeps its record: the report of a finished cycle must survive,
     * and only the board's own settlement moves the card.
     * @param taskId - the task owning the execution.
     * @param executionId - the execution to update.
     * @param verification - the new block.
     * @returns true when the ledger changed.
     */
    setVerification(taskId: string, executionId: string, verification: ExecutionVerification): boolean;
    private load;
    private normalizeDocument;
    /** Quarantine an unreadable document and start from an empty ledger. */
    private recoverCorrupt;
    private syncRecentRequests;
    private readSchedulerSidecar;
    /** Atomic write of the scheduler heartbeat sidecar (0600, tmp + rename + fsync). */
    private writeSchedulerSidecar;
    private commit;
    private notify;
    private acquireLock;
}
