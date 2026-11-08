import type { TypertGateway } from '@deepseek-ai/dsh-api-gateway';
import { HostTaskLedger } from './host-ledger.ts';
import { HostExecutionRunner, type GatewayPeer, type SessionCommandDispatcher, type TaskBoardWorkspaceRegistry } from './host-runner.ts';
import { PowerInhibitor } from './power-inhibitor.ts';
import { type TaskBoardAction, type TaskBoardEventPayload, type TaskBoardSnapshot } from './protocol.ts';
import type { CardDefaults } from './core/card-defaults.ts';
import { TaskBoardExtensionRegistry } from './host/extension-registry.ts';
import type { TaskBoardExtension } from './core/extension.ts';
import { type ScheduleMode } from './core/tasks.ts';
import { type ModelCatalogView, type VerificationContract, type VerificationSettings } from './core/verification.ts';
import type { TaskPermission } from './core/handover.ts';
import { type ModelInfoResolver, type TaskBoardAttachmentStore } from './host/attachments.ts';
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
 * Provenance of one cron-triggered run: when the rule fired and the zone
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
    /** The official attachment storage, read live so a late mount is honoured. */
    private readonly attachmentStore;
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
     * Admission control for the session-creating half of a run: one board action
     * opens a whole subtree, and this is what keeps the Host from asking DSH for
     * every member's session at once (see {@link LaunchAdmissionQueue}).
     */
    private readonly launches;
    /**
     * Consecutive unreadable-history polls per open execution (see
     * {@link noteUnreadableInspection}). Cleared as soon as an inspection
     * resolves, so a transient reader failure never fails a card.
     */
    private readonly unreadablePolls;
    private preventIdleSleep;
    private readonly verificationSettings;
    private readonly verificationCatalog;
    private readonly timers;
    /** Live reader of the global native-/goal switch; frozen per execution. */
    private readonly goalRunEnabled;
    /** Live reader of the deployment's new-card defaults (published and applied per create). */
    private readonly cardDefaults;
    /**
     * Live reader of the run-launch admission width: how many launches may be in
     * flight at once. Read at every admission, so a settings edit bounds the next
     * launch without remounting the row. Absent means the default.
     */
    private readonly runLaunchWidth;
    /**
     * Live reader of the daily token cap; 0 means no gate. Read at each run
     * action, so closing or raising the cap binds the next action.
     */
    private readonly spendBudgetTokens;
    /** Today's measured spend: absent measurement reads as "cannot see", never as zero. */
    private readonly spendUsedToday;
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
         * The owner peer every gateway request the runner makes speaks for.
         * Production passes the peer bound to the plugin fiber (see
         * {@link createOwnerPeer}); absent is fine for tests and bare mounts,
         * where the runner binds one to a fresh root context.
         */
        ownerPeer?: GatewayPeer;
        /**
         * Permission baseline of the confirmation gate: a fixed value, or a live
         * resolver the board re-reads so a Host Settings change needs no remount.
         */
        sessionDefaultPermission?: TaskPermission | (() => TaskPermission);
        maxSubtaskDepth?: number;
        /**
         * Live reader of the deployment's new-card defaults (volatile config reads).
         * The board publishes them for the create dialog and re-reads them for every
         * create that opts in, so a settings edit reaches the next created card
         * without remounting the row. Absent means the deployment configures none.
         */
        cardDefaults?: () => CardDefaults;
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
        /**
         * Live admission width for run launches: the number of launches (one
         * session creation and its prompt each) that may be in flight at once. Read
         * per admission, so editing the setting bounds the next launch of a run that
         * is still queueing. Absent means the default width.
         */
        runLaunchWidth?: () => number;
        /**
         * Live daily token cap (a volatile config read). 0 — the default, and what
         * every deployment that never configured one keeps — ends the gate before
         * anything is measured. A positive cap refuses a run whose day already spent
         * it, on both the action path and the cron path.
         */
        spendBudgetTokens?: () => number;
        /**
         * Today's measured spend in tokens, or undefined when this deployment keeps
         * no readable usage ledger. Defaults to the family usage ledger reader.
         */
        spendUsedToday?: (now: number) => number | undefined;
        /**
         * The official attachment storage, read at request time. Absent means the
         * deployment stores no attachments: every attachment action is then
         * refused and the board publishes no attachment limits.
         */
        attachments?: () => TaskBoardAttachmentStore | undefined;
        /**
         * The model-info reader the image preflight uses. Absent means the
         * deployment serves no model information, and a route whose modalities are
         * unknown is allowed.
         */
        modelInfo?: () => ModelInfoResolver | undefined;
        /**
         * Whether this deployment runs the legacy Agent Teams runtime. Read at
         * launch, only for a run the board is about to force under the dispatcher
         * preset: such a deployment cannot orchestrate, so the run fails closed on
         * the card instead of deadlocking in a session nobody answers (issue #2031).
         * Absent means "not proven legacy", which keeps the force exactly as it is.
         */
        legacyAgentTeams?: () => boolean;
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
    /**
     * The board's published snapshot.
     *
     * Every read path serializes this object — the HTTP `state` answer, the
     * `action` answer through {@link apply}, and the remote bridge's
     * `board.snapshot` — so a provider's integration credentials are stripped
     * once, here, instead of at each exit. The ledger keeps them verbatim for the
     * provider's own in-process read.
     */
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
    /**
     * Apply an action whose attachments the Host proved against the official
     * storage first.
     *
     * This is the board's trust boundary for attachment metadata: the browser
     * asserts the size, the type and the digest of every object it uploaded, and
     * the Host reads the stored objects back (an image is compared, a file is
     * streamed and its digest recomputed) before the ledger commits the claim.
     * An attachment the storage cannot prove is refused, so a spoofed client
     * claim never becomes a stored fact.
     */
    applyVerified(requestId: string, action: TaskBoardAction, initiator?: string): Promise<TaskBoardSnapshot>;
    /**
     * Prove every attachment of an action against the official storage.
     *
     * An action without attachments is untouched: the board keeps working in a
     * deployment that serves no attachment storage at all.
     */
    private verifyActionAttachments;
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
    /**
     * Refuse a run whose day already spent the cap.
     *
     * A cap of 0 — the shipped default — answers before the measurement is read:
     * no ledger file is opened and nothing is summed, which is what keeps a board
     * that never configured a cap identical to the one before it existed.
     *
     * The refusal is a thrown message rather than a code: the wire hands its text
     * to the caller as board-refused, exactly like every other refusal this board
     * makes.
     */
    private assertSpendCap;
    /** Route one provider action and answer the resulting board snapshot. */
    private handleExtensionAction;
    /** Current task id -> status map, for change detection around a mutation. */
    private statusMap;
    /** Emit a status change for every task whose column moved, isolated per callback. */
    private emitStatusChanges;
    dispose(): void;
    private launch;
    /**
     * Read the acceptance contract one run group freezes, in the order the board
     * has always read it: the acceptance settings, then the global native-/goal
     * switch, then the model catalog that both resolves the contract's route and
     * decides the reasoning effort the session may be given.
     */
    private freezeRunContract;
    /**
     * A {@link RunContractFreezer} that reads once and hands the SAME value to
     * every later caller of one run group. A read that fails is not cached: the
     * next member reads again, exactly as a per-execution read would have.
     */
    private contractFreezerForRunGroup;
    /**
     * Give back the occurrence a launch consumed, for a launch that never reached
     * a session: a failed launch, or one the Host abandoned while it was still
     * waiting for an admission slot. A manual run, and a launch that DID reach a
     * session, are never refunded.
     */
    private refundUnstartedSchedule;
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
     * @param force - continue the settled session regardless of the card's own
     *   opt-in (a rework), which the reuse rule accepts without waiving any of its
     *   evidence conditions.
     * @returns the session id to continue in, or undefined for a fresh session.
     */
    private reuseSessionFor;
    /**
     * The session a rework continues, or the refusal that says why it cannot.
     *
     * A rework exists for one conversation — the one the reviewer read before
     * sending the work back — so the evidence that this Host still reaches it is
     * required, exactly as it is for a card that opted into reuse. What a rework
     * does NOT get is the fresh-conversation fallback: launching there would hand
     * the reviewer's instructions to an agent that never saw the work, so the run
     * fails with a readable reason instead.
     * @param task - the card being reworked.
     * @returns the session id this rework continues in.
     */
    private reworkSessionFor;
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
     * Launch the one run a run request opened. A run request names one card and
     * opens one execution for it; the card's own session dispatches its subtasks
     * as subagents, so nothing else is enqueued here.
     *
     * The launch still goes through the admission queue, which admits at most
     * `runLaunchWidth` launches at a time — that bound now applies across
     * concurrent runs rather than across the members of one run.
     */
    private dispatchRuns;
    /**
     * Move one execution's applicability without touching its frozen contract or
     * its recorded attempts (used when the run's goal form becomes known).
     */
    private setApplicability;
    private scheduleLaunch;
    /**
     * Hand one launch to the admission queue, or abandon it on the spot when the
     * Host is already stopping: a queue entry created after {@link dispose} would
     * otherwise never be drained, and its card would sit in the running column
     * until the next Host start recovered it.
     */
    private enqueueLaunch;
    /** Whether one opened execution is still open in the ledger. */
    private isExecutionOpen;
    /**
     * Take one launch that never started out of the running column.
     *
     * Settled as CANCELLED, not failed: nothing about the run's work went wrong —
     * the Host stopped before the launch got a slot, which is exactly what the
     * next start's interrupted-start recovery records for an execution that never
     * reached a session. A scheduled occurrence that never reached a session is
     * refunded on the same terms as any other pre-session failure, so a run the
     * Host never started cannot silently spend the user's run budget.
     */
    private abandonQueuedRun;
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
