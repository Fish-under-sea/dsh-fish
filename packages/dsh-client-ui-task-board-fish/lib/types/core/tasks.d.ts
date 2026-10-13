/**
 * Task board domain model: task lifecycle statuses, the task record shape,
 * and the pure transition functions the controller and tests share.
 * Framework-free (no cordis, no runtime imports) so the state machine is
 * unit-testable in isolation.
 */
import type { FreezeSnapshot } from './freeze-snapshot.ts';
import type { ExecutionVerification } from './verification.ts';
import type { TaskHandover, TaskHandoverInput } from './handover.ts';
import { type TaskBoardExtensionPayload } from './extension.ts';
/** Task lifecycle status, one per kanban column. */
export type TaskStatus = 'backlog' | 'todo' | 'running' | 'done' | 'failed';
/** Settled outcome of one execution attempt. */
export type ExecutionOutcome = 'succeeded' | 'failed' | 'cancelled';
/**
 * One real execution attempt: the run's own id, the dsh session that ran it
 * (filled once the session is created), and the settled outcome once the
 * session's turn ended.
 */
export interface ExecutionRecord {
    /** Execution attempt id (uuid). */
    id: string;
    /** The dsh session that ran this attempt; absent until creation resolves. */
    sessionId: string | undefined;
    /** When the run started (ms epoch). */
    startedAt: number;
    /** When the run settled; absent while still running. */
    endedAt: number | undefined;
    /** Outcome once settled. */
    result: ExecutionOutcome | undefined;
    /** Human failure text when the run failed (prompt rejection or agent error). */
    error: string | undefined;
    /**
     * Session id of the DSH session that issued the run/rerun action (issue #6
     * audit origin). Client-asserted, not a trust boundary; absent when the run
     * was triggered by cron (source unknown).
     *
     * On an EXTERNAL record (issue #1826) this names the agent that completed the
     * work outside the Host instead, which is what makes the history readable.
     */
    initiatedBy?: string;
    /**
     * True when this outcome was recorded from outside the Host by
     * `record-external-outcome` rather than observed from a DSH session
     * (issue #1826).
     *
     * The board never manufactures one of these itself: every Host-side path
     * (`run`, `settle`, cascade folding, restart recovery) writes an execution
     * without it, so `external` is the single field separating work this Host ran
     * from work an outside agent reported. Such a record never carries a
     * `sessionId` and never claims a verdict the Host observed.
     */
    external?: boolean;
    /** Freeze instant captured from the card snapshot when the run opened. */
    frozenAt?: number;
    /** Freeze source session captured from the card snapshot when the run opened. */
    frozenBy?: string;
    /**
     * Cascade run group shared by the parent execution and every descendant
     * execution one run request opened. Absent on a plain single-task run.
     */
    runGroupId?: string;
    /**
     * A cascade parent's own session outcome, recorded as soon as its own turn
     * settles and held while its subtask executions finish. The execution stays
     * open (no `endedAt`) until the last child settles; the Host monitor skips
     * an execution whose own outcome is already recorded.
     */
    ownResult?: ExecutionOutcome;
    /** Human failure text that arrived with {@link ownResult}. */
    ownError?: string;
    /**
     * Goal acceptance state of this execution (task-board goal verification).
     * Fixed when the execution starts and never rewritten from later settings:
     * the contract is frozen here, the attempts accrue here, and the settlement
     * rule reads the pass record here. Absent on an execution that started
     * before the feature existed, which keeps it on the historical verdict.
     */
    verification?: ExecutionVerification;
}
/**
 * Maximum number of execution records retained per task. Older settled runs
 * are trimmed when a new execution starts so per-action ledger cost stays
 * bounded regardless of how often a task ran before.
 */
export declare const EXECUTION_HISTORY_LIMIT = 20;
/**
 * Trim an execution list to at most {@link EXECUTION_HISTORY_LIMIT} records,
 * most recent last. A running (unsettled) execution is never trimmed: the
 * Host monitor and restart recovery depend on the active record, and a task
 * cannot start a new run while one is still open.
 */
export declare function retainRecentExecutions(executions: readonly ExecutionRecord[]): ExecutionRecord[];
/**
 * How a rule produces its triggers: a recurring cron rule, or one single
 * planned instant. The distinction is stored rather than inferred so a
 * one-shot is never represented as a date-restricted cron expression.
 */
export type ScheduleMode = 'cron' | 'once';
/**
 * Why a due occurrence produced no run, or why a rule stopped on its own.
 *
 * These are stable codes, not display text: the board renders them through its
 * locale dictionary, so the ledger never carries a translated string.
 */
export type ScheduleStopReason = 
/** The single planned instant produced its run. */
'fired'
/** The recurring rule reached its run budget. */
 | 'limit'
/** The plan has no reachable instant any more (an impossible cron). */
 | 'no-target'
/** The instant passed while the board was not running through it. */
 | 'missed'
/** The task already had an open execution, so this occurrence was skipped. */
 | 'busy'
/** An above-default permission was still unconfirmed, so this occurrence was skipped. */
 | 'permission'
/**
 * A scheduled launch failed before any session existed, so the occurrence
 * created no execution and its run was refunded rather than spent.
 */
 | 'launch-failed';
/** Every stop reason this build understands; the repair and wire gates share it. */
export declare const SCHEDULE_STOP_REASONS: readonly ScheduleStopReason[];
/**
 * A scheduled-run rule attached to a task. The Host scheduler triggers the
 * task when `nextRunAt` is due and persists the rule in the Host ledger.
 *
 * A rule is either `cron` (the historical shape: a 5-field expression with an
 * explicit IANA zone, optionally capped by `maxRuns`) or `once` (one planned
 * instant, `at`, with an implicit budget of one run). Both modes count the
 * executions the scheduler actually started in `runCount`; a rule that reaches
 * its budget stops itself in the ledger (`enabled: false` + `endedReason`)
 * instead of relying on the execution agent to disable it.
 */
export interface ScheduleRule {
    /** Whether the schedule is armed. */
    enabled: boolean;
    /**
     * Which kind of plan this rule carries. A rule loaded from a ledger written
     * before the field existed normalizes to `cron` (its `cron` is the plan).
     */
    mode: ScheduleMode;
    /**
     * 5-field cron expression: `分 时 日 月 周`. Present on a `cron` rule and
     * absent on a `once` rule.
     */
    cron?: string;
    /**
     * The instant a `once` rule executes (ms epoch). Kept after the run so the
     * detail view can still show the planned time once the rule has ended.
     */
    at?: number;
    /**
     * IANA zone the wall clock is read in (issue #1722). Absent means the
     * Host process zone, which is what a rule written before zones were
     * persisted keeps using; the Host stamps its own zone at ledger migration so
     * a later `TZ` change cannot silently move an existing rule.
     */
    timeZone?: string;
    /** Next due instant (ms epoch); maintained by the scheduler/controller. */
    nextRunAt: number | undefined;
    /** Instant of the latest scheduled trigger (ms epoch). */
    lastTriggeredAt: number | undefined;
    /**
     * Scheduled executions the Host has created under this rule. This is the
     * run budget's counter: it counts executions that were successfully opened
     * (whatever their later outcome), never completions, and a manual run never
     * touches it. A skipped occurrence (busy / permission / missed / no target)
     * creates no execution and therefore consumes nothing.
     */
    runCount: number;
    /**
     * Maximum scheduled executions for a `cron` rule; absent means unlimited
     * (the historical behavior). A `once` rule has an implicit budget of one and
     * stores no `maxRuns`.
     */
    maxRuns?: number;
    /** Instant the rule stopped itself (ms epoch); absent while it may still fire. */
    endedAt?: number;
    /** Why the rule stopped itself; present with `endedAt`. */
    endedReason?: ScheduleStopReason;
    /** Instant of the latest occurrence that produced no run. */
    skippedAt?: number;
    /** Why that occurrence produced no run; present with `skippedAt`. */
    skippedReason?: ScheduleStopReason;
}
/**
 * The rule's total run budget: one for a one-shot, the stored cap for a
 * recurring rule, and undefined when the rule is unlimited.
 * @param rule - the schedule rule.
 * @returns the budget, or undefined for an uncapped rule.
 */
export declare function scheduleRunBudget(rule: ScheduleRule): number | undefined;
/**
 * Whether a rule has no runs left. The scheduler refuses to open another
 * execution for an exhausted rule, which is what makes the budget terminal
 * regardless of restarts or repeated timer fires.
 * @param rule - the schedule rule.
 * @returns true when the run budget is spent.
 */
export declare function scheduleExhausted(rule: ScheduleRule): boolean;
/**
 * The instant a rule plans to fire next, for display, whatever its mode: the
 * planned `at` of a one-shot, or the stored `nextRunAt` of a recurring rule.
 * @param rule - the schedule rule.
 * @returns the planned instant, or undefined when the rule carries none.
 */
export declare function schedulePlannedAt(rule: ScheduleRule): number | undefined;
/**
 * Frozen context snapshot carried by a continuation card (issue #4): the
 * goal/progress/next text (already sanitized by the freeze gates) plus the
 * freeze instant and the redaction warning flag.
 */
export interface TaskFreeze extends FreezeSnapshot {
    /** When the snapshot was frozen (ms epoch, stamped by the create/update use case). */
    frozenAt: number;
    /** True when the freeze gates redacted sensitive patterns out of the text. */
    redacted?: boolean;
    /**
     * Session id of the DSH session that authored the frozen snapshot (issue #6
     * provenance): stamped by the Host ledger from the create/update action's
     * initiator, or kept from the wire payload when no initiator was asserted.
     */
    frozenBy?: string;
}
/**
 * One task label (issue #1521). The name is the badge and the tag-filter key;
 * the optional prompt line rides the execution prompt, so a label may be
 * display-only (no prefix) or carry an instruction (business-line routing,
 * output directory, house style) that every run of the task inherits.
 */
export interface TaskTag {
    /** Display name; trimmed, non-empty, unique within the task. */
    name: string;
    /**
     * Prompt line injected ahead of the execution prompt. Absent (or blank
     * after trimming) keeps the tag display-only: it never touches the prompt,
     * so a label with no prefix has zero execution side effects.
     */
    promptPrefix?: string;
}
/** Maximum number of tags carried by one task. */
export declare const TASK_TAG_LIMIT = 8;
/** Maximum length of a tag name. */
export declare const TAG_NAME_MAX_LENGTH = 32;
/** Maximum length of a tag's injected prompt line. */
export declare const TAG_PROMPT_MAX_LENGTH = 200;
/** Whether an unknown value is a well-formed tag (strict: the wire gate). */
export declare function isTaskTag(value: unknown): value is TaskTag;
/**
 * Whether an unknown value is a well-formed tag list (strict: the wire gate).
 * An empty list is rejected — clearing tags is expressed by omitting the field
 * (create) or by an explicit null (update), never by an empty array.
 */
export declare function isTaskTagList(value: unknown): value is TaskTag[];
/**
 * Repair a persisted tag list: keep the well-formed entries, trim, drop
 * blanks and repeats, cap the count, and collapse a blank prompt line to
 * "display-only". Returns undefined when nothing usable remains, so the caller
 * clears the field instead of storing an empty array.
 */
export declare function normalizeTags(value: unknown): TaskTag[] | undefined;
/**
 * Stable palette slot (0..5) for a tag name. The same label always lands on the
 * same tone, so a badge needs no stored colour and two tasks sharing a label
 * cannot disagree about it.
 */
export declare function tagTone(name: string): number;
/**
 * Union of the labels already carried by `tasks`, first occurrence wins (the
 * oldest task's hint is the one offered). Feeds the editor's name datalist and
 * the board's tag filter, so a label defined once can be reused everywhere.
 */
export declare function collectKnownTags(tasks: readonly TaskRecord[]): TaskTag[];
/** One task on the board. */
export interface TaskRecord {
    /** Stable task id (uuid). */
    id: string;
    /** Short display title. */
    title: string;
    /** Longer human description shown in the detail view. */
    description: string;
    /** The prompt sent to dsh when this task is executed. */
    prompt: string;
    /**
     * Parent task id: present only on a subtask. The Host owns the lineage gate
     * (see `core/subtask.ts`), which refuses a cycle, an archived parent, and
     * any link that would exceed `maxSubtaskDepth` — so every chain the Host
     * wrote under the current setting is at most that many links long. Lowering
     * the limit later neither rewrites nor deletes an already stored link.
     */
    parentId?: string;
    /** Current column. */
    status: TaskStatus;
    /** Creation instant (ms epoch). */
    createdAt: number;
    /** Last mutation instant (ms epoch). */
    updatedAt: number;
    /**
     * Execution history retained on the task, most recent last: the latest
     * {@link EXECUTION_HISTORY_LIMIT} attempts, oldest trimmed on append.
     */
    executions: ExecutionRecord[];
    /** Optional scheduled-run rule (absent on tasks without a schedule). */
    schedule?: ScheduleRule;
    /**
     * Workspace the execution must run in (a workspace-list id); absent means
     * the recent-workspace fallback at execution time.
     */
    workspaceId?: string;
    /**
     * Agent preset the execution session must be composed from (an
     * `agentPreset.list` id); absent means the deployment default.
     */
    mode?: string;
    /**
     * Permission preset applied to the execution session through the
     * `/permission <id>` slash command; absent leaves the session default.
     */
    permission?: TaskPermission;
    /**
     * Pinned model selection for the execution session (format: "provider/model" or model id);
     * absent falls back to the host default (agent-default-model).
     */
    model?: string;
    /**
     * Whether later executions continue in the previous execution's session
     * (issue #1419) instead of minting a fresh conversation per run. Absent or
     * false keeps the historical one-session-per-execution behavior; the reuse
     * itself only happens when that session is idle and still present (see
     * {@link reusableSessionId}).
     */
    reuseSession?: boolean;
    /**
     * Run this task's subtree as an Agent Team instead of one Host-launched
     * session per participant: the root becomes the Team Lead session and the
     * Host spawns one teammate for each direct subtask inside it. Absent or false
     * keeps the plain concurrent cascade. A deployment that does not serve the
     * Agent Teams service refuses a team run instead of silently falling back,
     * and a subtask's own permission pin cannot be honored in this mode.
     */
    teamRun?: boolean;
    /**
     * Start every execution of this task with dsh's built-in `/goal` command,
     * armed with the composed execution prompt as its objective. The session then
     * keeps working automatic continuation rounds until the agent marks the goal
     * complete, and this board settles the execution on the goal's own end
     * instead of at the first turn end. Absent means OFF — the option is
     * unchecked by default, so only an explicit `true` joins the goal run and
     * every card that never touched it (including every card written before the
     * field existed) runs one plain turn. A session whose `/goal` command is
     * refused still runs the prompt.
     */
    goalRun?: boolean;
    /**
     * Run this task's goal executions WITHOUT the board's acceptance gate.
     *
     * Absent means INHERIT: the execution's applicability is decided by the
     * board-wide `goalVerification` switch frozen at start, exactly as a card
     * that never touched this option behaves. Only an explicit `true` opts the
     * card out, and the execution records `applicability: 'disabled'` so the
     * report says plainly that nothing certified this run.
     *
     * The opt-out is per execution, not per run: flipping it never rewrites the
     * verdict rule of an execution already open, and a rerun or a scheduled
     * occurrence reads the card's current value when it freezes its contract.
     */
    skipVerification?: boolean;
    /**
     * Frozen context snapshot for a continuation card; absent on plain tasks.
     * Sanitized before it enters the ledger (redaction, slash-command taint,
     * 8 KiB per-field cap) by the protocol gate and re-normalized on load.
     */
    freeze?: TaskFreeze;
    /**
     * Handover bundle carried by a continuation card (issue #5): the pinned
     * execution triplet plus doc/script references. Sanitized before it
     * enters the ledger by the protocol gate and re-normalized on load; the
     * bundle's triplet overrides the legacy pin fields at execution time.
     */
    handover?: TaskHandover;
    /**
     * Task labels (issue #1521): optional, additive, and absent on every task
     * created before the field existed. A tag whose `promptPrefix` is set is
     * prepended to the execution prompt; a bare name is display and filter only.
     */
    tags?: TaskTag[];
    /**
     * Human confirmation stamp for an above-default effective permission
     * (ms epoch). Absent while the binding awaits confirmation; any permission
     * or handover change re-arms the gate by clearing it.
     */
    permissionConfirmedAt?: number;
    /**
     * When the task was archived (ms epoch). Archived tasks keep their status
     * and execution history, leave the main board, and cannot run until restored;
     * absent means on-board.
     */
    archivedAt?: number;
    /**
     * Opaque external-provider metadata, keyed by extension id; optional and
     * additive so existing tasks require no ledger migration. The board stores
     * and forwards it without interpreting the keys — each provider owns the
     * shape and validation of its own entry.
     */
    integrations?: Record<string, TaskBoardExtensionPayload>;
    /**
     * Whether the card is held off the board: it exists in the ledger (and its
     * execution history is intact) but no column ever renders it. Providers
     * create hidden cards for work they materialize but do not want displayed;
     * absent means on-board.
     */
    hidden?: boolean;
}
/**
 * Statuses a task may be archived from: every status but `running`, whose
 * execution the runner still owns until it settles. A settled-only gate made
 * the duplicate-and-archive flow a silent no-op for scheduled tasks, which
 * return to `todo` after every successful run (issue #1447).
 */
export declare const ARCHIVABLE_STATUSES: readonly TaskStatus[];
/** Permission presets a task may pin on its execution session (the `/permission <id>` ids). */
export declare const TASK_PERMISSIONS: readonly ["read-only", "workspace-write", "danger-full-access"];
/** One permission preset id. */
export type TaskPermission = typeof TASK_PERMISSIONS[number];
/** Whether an unknown value is a known permission preset id. */
export declare function isTaskPermission(value: unknown): value is TaskPermission;
/** Input for creating a task. */
export interface NewTaskInput {
    title: string;
    description: string;
    prompt: string;
    /**
     * Parent task id, turning this creation into a subtask. Absent keeps a root
     * task; the create use case validates the link (existence, depth) and
     * inherits the parent's unset execution targets.
     */
    parentId?: string;
    /** Workspace the execution must run in; empty/absent = the creating session's workspace for a root task, else the recent workspace at execution time. */
    workspaceId?: string;
    /** Agent preset the execution session must be composed from; empty/absent = deployment default. */
    mode?: string;
    /** Permission preset applied to the execution session; absent = session default. */
    permission?: TaskPermission;
    /** Optional pinned model for the execution session; absent = host default. */
    model?: string;
    /** Reuse the previous execution's session for later runs (issue #1419). */
    reuseSession?: boolean;
    /** Run the subtree as an Agent Team (Team Lead session plus one teammate per direct subtask). */
    teamRun?: boolean;
    /**
     * Start the execution with dsh's built-in `/goal`. Absent means the default
     * (one plain turn); only an explicit true joins the goal run.
     */
    goalRun?: boolean;
    /**
     * Run this task's goal executions without the acceptance gate; absent
     * inherits the board-wide `goalVerification` switch.
     */
    skipVerification?: boolean;
    /**
     * Optional scheduling rule requested at creation time (the new-task
     * dialog): an enable flag, the kind of plan (a recurring 5-field cron
     * expression, or one planned instant for a one-shot), an optional run cap,
     * and the IANA zone its wall clock is read in (absent means the Host zone).
     * The create use case arms it only when enabled and the plan is valid.
     */
    schedule?: {
        enabled: boolean;
        mode?: ScheduleMode;
        cron?: string;
        /** Planned instant of a one-shot rule (ms epoch). */
        at?: number;
        timeZone?: string;
        /** Run cap of a recurring rule; absent means unlimited. */
        maxRuns?: number;
    };
    /**
     * Optional frozen context snapshot (goal/progress/next, sanitized by the
     * protocol gate) turning the new task into a continuation card.
     */
    freeze?: FreezeSnapshot & {
        redacted?: boolean;
        frozenBy?: string;
    };
    /**
     * Optional handover bundle (pinned triplet + doc/script references,
     * sanitized by the protocol gate) attached at creation.
     */
    handover?: TaskHandoverInput;
    /**
     * Optional task labels. A tag with a non-blank `promptPrefix` is injected
     * ahead of the execution prompt; a bare name changes nothing at run time.
     */
    tags?: TaskTag[];
    /** Opaque external-provider metadata keyed by extension id. */
    integrations?: Record<string, TaskBoardExtensionPayload>;
    /** Column the created card opens in; absent means the board default (todo). */
    status?: TaskStatus;
    /** Create the card off-board (held in the ledger, never rendered). */
    hidden?: boolean;
}
/** The five kanban columns, in display order. */
export declare const COLUMNS: readonly {
    status: TaskStatus;
    label: string;
}[];
/**
 * Statuses a card may be moved to by hand: every column. The board UI and the
 * agent tool surface share this one list, so no column can be manual on one
 * surface and locked on the other.
 *
 * The column is a board statement, not a claim about a run. A hand-written
 * `done`/`failed` declares that the work finished (or failed) outside a
 * Host-run execution — human hands, an external system — and a hand-written
 * `running` says the work is under way without a tracked session. None of them
 * creates an {@link ExecutionRecord}, which is what keeps a declaration
 * distinguishable from a recorded outcome in the card's execution history; the
 * next settled run overwrites the column with the real one.
 */
export declare const MANUAL_STATUSES: readonly TaskStatus[];
/** Statuses the runner may move a card to from 'running'. */
export declare const RUNNER_SETTLE_STATUSES: readonly TaskStatus[];
/** All valid statuses (closed union guard). */
export declare const ALL_STATUSES: readonly TaskStatus[];
/** Brand an unknown string as a status; undefined when it is not one. */
export declare function isTaskStatus(value: unknown): value is TaskStatus;
/**
 * Whether the manual move `from` -> `to` is a legal *column* change: any
 * column, and never the one the card already shows.
 *
 * Whether the card may be moved at all is a separate question. The lock an
 * executing card carries belongs to its open execution, never to the column
 * text, so it is {@link canMoveTask} — not this predicate — that expresses it.
 */
export declare function canMoveManually(from: TaskStatus, to: TaskStatus): boolean;
/**
 * Whether the board may move `task` to `to` by hand: the card is on-board,
 * holds no open execution, and the target is a legal column change. The ledger,
 * the detail view's status buttons and the board's drop handler all decide
 * through this one predicate, so no two surfaces can disagree about a card.
 */
export declare function canMoveTask(task: TaskRecord, to: TaskStatus): boolean;
/**
 * Whether the task still has an execution the runner has not settled. This —
 * not the `running` column — is what "the runner owns this card" means: a card
 * parked in `running` by hand has no session and stays fully movable.
 */
export declare function hasOpenExecution(task: TaskRecord): boolean;
/** Normalize one optional execution-target string: trim; blank collapses to undefined. */
export declare function normalizeTargetId(value: string | undefined): string | undefined;
/**
 * Build the persisted freeze snapshot from a sanitized input, stamping the
 * freeze instant (shared by the create and update use cases).
 */
export declare function freezeOf(input: FreezeSnapshot & {
    redacted?: boolean;
    frozenBy?: string;
}, now: number): TaskFreeze;
/** Create a task from user input. */
export declare function createTask(input: NewTaskInput, now: number, id: string): TaskRecord;
/** Clone a task with an updated status and a fresh updatedAt. */
export declare function withStatus(task: TaskRecord, status: TaskStatus, now: number): TaskRecord;
/**
 * Merge a schedule patch into a task's schedule rule (creating it when
 * absent), with a fresh updatedAt. Keys present in the patch overwrite the
 * current value — including explicit `undefined`, which clears a field (used
 * to disarm `nextRunAt` or to drop an ended/skip record); absent keys keep
 * their current value.
 */
export declare function withSchedule(task: TaskRecord, patch: Partial<ScheduleRule>, now: number): TaskRecord;
/**
 * Open a fresh execution on a task: move it to 'running' and append a
 * running execution record. Returns the new task and the new execution.
 * @param runGroupId - cascade run group, when this run also opened executions
 *   for the task's subtasks (see `core/subtask.ts`).
 */
export declare function startExecution(task: TaskRecord, now: number, executionId: string, initiatedBy?: string, runGroupId?: string): {
    task: TaskRecord;
    execution: ExecutionRecord;
};
/**
 * The column a settled outcome puts a card in. The ONE derivation shared by
 * every settlement path (issue #1826): a Host-run execution and an outcome an
 * outside agent reported both land in the same column from the same rule, so
 * the column never becomes a second, independent piece of state.
 @param task - the card being settled.
 @param outcome - the settled outcome.
 @returns the status the card shows afterwards.
 */
export declare function settledStatus(task: TaskRecord, outcome: ExecutionOutcome): TaskStatus;
/**
 * Settle a running execution: record the outcome and move the task into the
 * matching column. No-op (returns the input task) when the execution is not
 * the task's latest or is already settled.
 */
export declare function settleExecution(task: TaskRecord, executionId: string, outcome: ExecutionOutcome, now: number, error: string | undefined): TaskRecord;
/** A settled-execution summary string for the detail view. */
export declare function executionLabel(execution: ExecutionRecord): string;
