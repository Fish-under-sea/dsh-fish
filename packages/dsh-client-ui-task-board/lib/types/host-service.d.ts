import type { TypertGateway } from '@deepseek-ai/dsh-api-gateway';
import { HostTaskLedger } from './host-ledger.ts';
import { HostExecutionRunner, type SessionCommandDispatcher, type TaskBoardWorkspaceRegistry } from './host-runner.ts';
import { PowerInhibitor } from './power-inhibitor.ts';
import { type TaskBoardAction, type TaskBoardEventPayload, type TaskBoardSnapshot } from './protocol.ts';
import { TaskBoardExtensionRegistry } from './host/extension-registry.ts';
import type { TaskBoardExtension } from './core/extension.ts';
import type { ScheduleMode } from './core/tasks.ts';
import { type ModelCatalogView, type VerificationContract, type VerificationSettings } from './core/verification.ts';
import type { TaskPermission } from './core/handover.ts';
/** One teammate the Host asks the Agent Teams service to spawn for a team run. */
export interface TeamSpawnInput {
    /** Session id of the run's Team Lead (the root task's execution session). */
    leadSessionId: string;
    /** Immutable lower-kebab-case teammate name, unique inside the Team. */
    name: string;
    /** Short description of the delegated responsibility. */
    description: string;
    /** The subtask's execution prompt. */
    prompt: string;
}
/** Result of one teammate spawn attempt. */
export interface TeamSpawnResult {
    /** The teammate's session id when it reached the active edge. */
    sessionId?: string;
    /** Why the spawn failed: a thrown call, or a member that settled as failed. */
    error?: string;
}
/**
 * The Agent Teams capability the Host needs for team-mode runs. The plugin
 * builds it from the optional `agentTeams` service; it is absent when this
 * deployment does not serve that service, in which case a team run is refused
 * instead of silently degrading into a plain cascade.
 */
export interface TaskBoardTeamDispatcher {
    spawn(input: TeamSpawnInput): Promise<TeamSpawnResult>;
}
/**
 * Why an enforced goal execution settled failed while its acceptance DID run:
 * attempts were recorded and none of them passed. The judge answered about the
 * work and the work did not pass.
 */
export declare const NO_MATCHING_PASS_VERIFICATION_REASON = "goal \u9A8C\u6536\uFF1A\u672C\u6B21\u6267\u884C\u6CA1\u6709\u5339\u914D\u7684\u9A8C\u6536\u901A\u8FC7\u8BB0\u5F55\uFF08\u9A8C\u6536\u672A\u8FD0\u884C\u3001\u672A\u901A\u8FC7\u6216\u62A5\u544A\u6765\u81EA\u5176\u4ED6\u6267\u884C\uFF09\uFF0C\u6309\u672A\u9A8C\u6536\u5224\u5931\u8D25\u3002";
/**
 * Why an enforced goal execution settled failed with ZERO acceptance records:
 * the gate was never opened, so the judge never ran and nothing was ever judged
 * (issue #1837). The root cause is a session that declared completion in prose
 * instead of calling `update_goal(action: complete)` — a tool-adherence problem,
 * NOT a quality verdict on the delivery — so this reason says so and keeps the
 * two investigation directions apart.
 */
export declare const NEVER_INVOKED_VERIFICATION_REASON = "goal \u9A8C\u6536\u672A\u89E6\u53D1\uFF1A\u672C\u6B21\u6267\u884C\u6CA1\u6709\u4EFB\u4F55\u9A8C\u6536\u8BB0\u5F55\uFF0C\u9A8C\u6536\u95E8\u4ECE\u672A\u6253\u5F00\u2014\u2014\u6267\u884C\u4F1A\u8BDD\u6CA1\u6709\u8C03\u7528 update_goal(action: complete) \u6765\u5B8C\u6210\u76EE\u6807\uFF08\u5E38\u89C1\u4E8E\u53EA\u5728\u56DE\u590D\u91CC\u5BA3\u544A\u5B8C\u6210\uFF09\u3002\u8FD9\u4E0D\u662F\u8D28\u91CF\u5224\u8D1F\uFF1A\u4EA4\u4ED8\u4ECE\u672A\u88AB\u88C1\u5224\u8BC4\u4F30\u3002";
/**
 * Why an enforced goal execution settled failed while its ONLY acceptance
 * records are INVALID: the judge answered but could not locate its own
 * rejection, so the board stopped calling it. This is NOT an evidence-backed
 * quality veto — the requirement is explicit that such a run must not be
 * described as one — but the execution still has no matching pass, so it ends
 * for lack of one, and the reason names that precisely.
 */
export declare const INVALID_ONLY_VERIFICATION_REASON = "goal \u9A8C\u6536\u65E0\u6548\uFF1A\u672C\u6B21\u6267\u884C\u53EA\u8BB0\u5F55\u4E86\u65E0\u6548\u9A8C\u6536\uFF08\u88C1\u5224\u672A\u80FD\u7ED9\u51FA\u4E0E\u4EFB\u52A1\u8981\u6C42\u5BF9\u5E94\u3001\u4E14\u53EF\u5B9A\u4F4D\u5230\u672C\u6B21\u8BC1\u636E\u7684\u5426\u51B3\u4F9D\u636E\uFF09\uFF0C\u770B\u677F\u5DF2\u505C\u6B62\u8C03\u7528\u88C1\u5224\u3002\u8FD9**\u4E0D\u662F**\u6709\u8BC1\u636E\u7684\u8D28\u91CF\u5224\u8D1F\uFF1A\u9A8C\u6536\u672C\u8EAB\u4E0D\u53EF\u7528\uFF0C\u672C\u6B21\u8FD0\u884C\u56E0\u6CA1\u6709\u5339\u914D\u7684\u901A\u8FC7\u8BB0\u5F55\u800C\u7ED3\u675F\u3002\u8BF7\u68C0\u67E5\u9A8C\u6536\u73AF\u5883\u4E0E\u8BC1\u636E\u53EF\u89C1\u6027\uFF0C\u6216\u7528 task_board_manage(action=reset-verification) \u6E05\u9664\u8BB0\u5F55\u7684\u65E0\u6548\u9A8C\u6536\u540E\u91CD\u65B0\u5B8C\u6210\u76EE\u6807\u3002";
/**
 * Provenance of one cron-triggered cascade: when the rule fired and the zone
 * its wall clock was read in. Passed into every launched prompt of that run so
 * a scheduled job knows its own clock rather than inferring one.
 */
export interface ScheduledRunContext {
    triggeredAt: number;
    timeZone: string;
    /** Whether this fire came from a recurring rule or a single planned instant. */
    mode: ScheduleMode;
    /** Cron expression of a recurring rule; absent on a one-shot. */
    cron?: string;
}
/**
 * The native timer face the Host arms through. The cordis `timer` service
 * (dsh-base's own `cordis-plugin-timer` row) provides it: its handles are
 * registered on the owning fiber, so unloading the board clears every armed
 * timer without this service tracking handles by hand. A composition that
 * serves no timer service falls back to the process globals.
 */
export interface HostTimerFace {
    timeout(callback: () => void, delay: number): () => void;
    interval(callback: () => void, delay: number): () => void;
}
export declare class TaskBoardHostService {
    readonly ledger: HostTaskLedger;
    readonly runner: HostExecutionRunner;
    readonly power: PowerInhibitor;
    private readonly listeners;
    /** The one recurring timer: the session-roster poll. */
    private pollTimer;
    /** Cadence of the roster poll, in seconds (a settings field; see the config schema). */
    private sessionPollSeconds;
    /** Pending delay that follows a failed poll pass, if one is armed. */
    private pollBackoffTimer;
    /** Consecutive failed poll passes; doubles the next retry delay. */
    private consecutivePollFailures;
    /** The armed schedule timer, if a trigger is pending. */
    private scheduleTimer;
    /** The instant the armed schedule timer targets (ms epoch), for resume detection. */
    private scheduleTarget;
    private disposed;
    private pollInFlight;
    private active;
    /**
     * Consecutive unreadable-history polls per open execution (see
     * {@link noteUnreadableInspection}). Cleared as soon as an inspection
     * resolves, so a transient reader failure never fails a card.
     */
    private readonly unreadablePolls;
    private preventIdleSleep;
    private readonly verificationSettings;
    private readonly verificationCatalog;
    private readonly team;
    private readonly timers;
    /** Live reader of the global native-/goal switch; frozen per execution. */
    private readonly goalRunEnabled;
    private lastPowerJson;
    private readonly now;
    /** The deployment's workspaces, consulted to resolve a card that pins none. */
    private readonly workspaceRegistry;
    /**
     * External provider extensions. The board owns task lifecycle and execution;
     * a provider observes them through the registry's capability face and never
     * reaches into the ledger itself.
     */
    readonly extensions: TaskBoardExtensionRegistry;
    constructor(gateway: TypertGateway, options?: {
        ledger?: HostTaskLedger;
        power?: PowerInhibitor;
        now?: () => number;
        commandDispatcher?: SessionCommandDispatcher;
        workspaceRegistry?: TaskBoardWorkspaceRegistry;
        /**
         * Permission baseline of the confirmation gate: a fixed value, or a live
         * resolver the board re-reads so a Host Settings change needs no remount.
         */
        sessionDefaultPermission?: TaskPermission | (() => TaskPermission);
        maxSubtaskDepth?: number;
        team?: TaskBoardTeamDispatcher;
        timers?: HostTimerFace;
        /**
         * Live GLOBAL native /goal switch (a volatile config read). Read ONCE per
         * execution, at launch, and carried by value from then on: a settings edit
         * made while a run is in flight must not arm, disarm or otherwise change the
         * goal/acceptance contract of that run. Absent means OFF, which is the
         * default for every deployment that never configured it.
         */
        goalRunEnabled?: () => boolean;
        /**
         * Live acceptance settings (volatile config reads). Absent keeps goal
         * acceptance OFF for every execution this service opens, which is what a
         * programmatic mount without the settings domain gets.
         */
        verificationSettings?: () => VerificationSettings;
        /** The host model catalog the acceptance contract resolves its route from. */
        verificationCatalog?: () => Promise<ModelCatalogView | undefined>;
    });
    start(): void;
    /**
     * Apply the live configuration. The roster cadence is re-read on every
     * commit, so a settings edit takes effect without a restart; the poll is
     * scheduled at the new cadence immediately rather than waiting out the old
     * interval.
     * @param active - the board's master switch.
     * @param preventIdleSleep - whether the board holds an idle-sleep assertion.
     * @param sessionPollSeconds - roster-poll cadence in seconds (clamped).
     */
    setConfiguration(active: boolean, preventIdleSleep: boolean, sessionPollSeconds?: number): void;
    snapshot(): TaskBoardSnapshot;
    /**
     * Admit one external provider. Idempotent by extension id; the returned
     * disposer releases it (its stored data stays).
     */
    registerExtension(extension: TaskBoardExtension): () => void;
    /**
     * The acceptance configuration the settings card displays: the live settings,
     * the contract they resolve to, and the host catalog the choices come from.
     *
     * The card shows the RESOLVED route, not the raw configuration, so "inherit
     * host" reads as the concrete model and reasoning level the next execution
     * will actually freeze, including any recorded effort fallback.
     * @returns the resolved acceptance options.
     */
    verificationOptions(): Promise<{
        settings: VerificationSettings;
        contract: VerificationContract;
        catalog: ModelCatalogView;
    }>;
    /** SSE frame payload; deliberately skips the tasks deep-clone of {@link snapshot}. */
    eventPayload(): TaskBoardEventPayload;
    subscribe(listener: () => void): () => void;
    /**
     * Give a root card created without a workspace pin the workspace its creator
     * is in.
     *
     * An agent's `task_board_create` arrives with the calling session, and the
     * GUI submits the session the main view shows, so the card lands where the
     * work was asked for instead of where the Host process happens to run. A card
     * that names a workspace keeps it, and a subtask keeps inheriting its lineage
     * (the runner walks the ancestor chain for that).
     *
     * The initiator is client-asserted, so it only chooses among workspaces the
     * deployment already knows: it can neither register one nor reach outside the
     * list the user sees.
     * @param action - the action about to be applied.
     * @param initiator - the session that issued the action, when one was asserted.
     * @returns the action, with an inherited workspace on a root creation.
     */
    private withInheritedWorkspace;
    apply(requestId: string, action: Extract<TaskBoardAction, {
        kind: 'extension-action';
    }>, initiator?: string): Promise<TaskBoardSnapshot>;
    apply(requestId: string, action: Exclude<TaskBoardAction, {
        kind: 'extension-action';
    }>, initiator?: string): TaskBoardSnapshot;
    apply(requestId: string, action: TaskBoardAction, initiator?: string): TaskBoardSnapshot | Promise<TaskBoardSnapshot>;
    /**
     * Apply one board-owned action with every gate intact. Provider capability
     * calls and the same-origin wire both land here, so the two surfaces can
     * never disagree about a card.
     */
    private applyBoardAction;
    /** Route one provider action and answer the resulting board snapshot. */
    private handleExtensionAction;
    /** Current task id -> status map, for change detection around a mutation. */
    private statusMap;
    /** Emit a status change for every task whose column moved, isolated per callback. */
    private emitStatusChanges;
    dispose(): void;
    private launch;
    private scheduleTeammate;
    /**
     * Spawn one teammate inside the Lead session and attach the teammate's
     * session to the subtask execution, so the existing session monitor settles
     * it from the teammate's own turn like any other execution. A spawn that
     * fails settles the subtask as failed immediately, which then folds into the
     * Lead's cascade verdict.
     */
    private spawnTeammate;
    /**
     * One roster pass, and whether it could read the session tree.
     *
     * The board reads the DSH session roster only while it has something the
     * roster can decide: an execution to inspect, or a card parked in the running
     * column whose verdict may arrive from a settle this process never saw. That
     * gate is what removes the cost the reporter measured — `session/list`
     * rebuilds every persisted session row (string conversion, object allocation,
     * a stat per record), and an idle board with no tasks was paying it every few
     * seconds forever.
     * @returns whether the roster was readable (an idle pass counts as readable).
     */
    private pollSessions;
    /**
     * The session a run may continue in, for a card that opted into reuse
     * (issue #1419). Reuse requires positive evidence that the previous session
     * is present and idle, and that evidence must be read for THIS launch: an
     * idle board no longer polls, so a roster cached from an earlier pass could
     * be hours old — either refusing a session that has been idle all along, or
     * prompting into one that started running since. A card that did not opt in
     * reads no roster at all, and a read that fails mints a fresh conversation
     * exactly as an unknown roster always did.
     * @param task - the task about to run.
     * @returns the session id to continue in, or undefined for a fresh session.
     */
    private reuseSessionFor;
    /** Reuse the session list this poll already fetched: one list RPC per tick, not 1 + E. */
    private reconcileExecutions;
    /**
     * Count one poll whose session history could not be read. A reader failure is
     * not progress: the session is not running (the runner only reads history for
     * one that is idle), so nothing will ever change that verdict. After
     * {@link UNREADABLE_SETTLE_POLLS} consecutive polls the execution is reported
     * failed with the recorded reason, instead of holding its card — and every
     * ancestor of it — in the running column with no way out. The first poll of
     * each streak is logged, so the Host log names the session.
     */
    private settleAndNotify;
    /**
     * Remove one execution's acceptance-only detail after it PASSED and settled.
     *
     * Deliberately narrow: only the acceptance mechanism's own per-attempt
     * material (findings, invalid diagnostics, the bulky judge side) is removed,
     * and only for THIS execution, keyed by its own id in the ledger it belongs
     * to. No user file, task artifact, raw session history or other execution's
     * record is read or written. Idempotent by the record's own state, and it
     * clearly never touches a run that did not pass (the caller's guard) — a
     * failed or invalid execution keeps everything a repair or a review needs.
     * @param taskId - the task whose execution settled.
     * @param executionId - the settled execution.
     */
    private cleanupAcceptanceDetail;
    /**
     * Catch-up pass: clean the acceptance detail of every execution that PASSED
     * and settled but whose cleanup did not finish (a crash, a failed write, a
     * Host killed mid-cleanup).
     *
     * The same bounds as any other cleanup apply — only a real pass record on a
     * settled execution is touched — so this can never delete material belonging
     * to an execution that did not pass, and never a user file.
     */
    private cleanupPendingAcceptanceDetail;
    private noteUnreadableInspection;
    /** Drop the armed schedule timer and forget its target. */
    private clearScheduleTimer;
    /**
     * Boot / resume recovery: skip every occurrence that came due while the
     * board was not running and roll each schedule to its next future target,
     * then arm the timer for the nearest one. Rendering the occurrence is
     * deliberately not attempted: the ACL of a card that fired hours ago is
     * stale, and the board's own recovery contract is "missed triggers are
     * skipped, never replayed".
     */
    private recoverSchedule;
    /**
     * Arm the native timer at the nearest armed future trigger. One timer serves
     * every schedule: the ledger's next target is the only instant the Host has
     * to wake for. A target beyond the platform's timer ceiling re-arms in
     * segments, and a target already past (the wall clock jumped, or the process
     * was suspended) is handled immediately as a recovery.
     */
    private armSchedule;
    /**
     * One armed target became due. A fire landing well past its target is a
     * resume (suspend, throttle, forward clock jump) rather than a normal
     * occurrence, so it takes the recovery path instead of launching a run for a
     * long-stale instant.
     */
    private onScheduleFire;
    private armedSchedules;
    /**
     * Launch one run set. The root goes first and receives the run shape in its
     * prompt (which members this run opens, and how they run); every plain-cascade
     * member then launches on its own so one refused participant cannot hold the
     * others back. A team run's members are spawned inside the root's Lead
     * session instead, once that session exists.
     */
    private dispatchRuns;
    /**
     * Move one execution's applicability without touching its frozen contract or
     * its recorded attempts (used when the run's goal form becomes known).
     */
    private setApplicability;
    private scheduleLaunch;
    private schedulePoll;
    /**
     * Count one failed pass and arm the retry that follows it.
     *
     * A session tree that is down is retried on a doubling delay instead of
     * hammering it on the fixed cadence: the heartbeat would otherwise repeat
     * every failure — and every retry inside {@link HostExecutionRunner.listRunning}
     * — at exactly the interval the reporter measured.
     */
    private notePollFailure;
    /** Arm the retry that follows a failed pass, doubling up to the ceiling. */
    private armPollBackoff;
    /** Drop a pending retry; the next regular tick takes over. */
    private clearPollBackoff;
    /**
     * Re-arm from the ledger's current targets. Callers that just changed a
     * schedule (the host routes, the agent tools) invoke this after the write
     * commits, so a new or edited trigger arms without waiting for the next fire.
     */
    refreshSchedule(): void;
    private syncPowerReasons;
    private emit;
}
/**
 * Install stream error listeners on process.stderr and process.stdout so that
 * transient write failures (e.g. ENOSPC when the disk is full, or EPIPE on a
 * closed pipe) never emit unhandled 'error' events that kill the Node.js host process.
 */
export declare function installStreamErrorGuards(): void;
/**
 * Defensively log to console.error without letting stderr write failures
 * (e.g. ENOSPC from SyncWriteStream on redirected logs) crash the host process.
 */
export declare function safeConsoleError(message: string, ...args: unknown[]): void;
