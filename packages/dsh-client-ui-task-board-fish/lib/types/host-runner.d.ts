import { Context } from '@deepseek-ai/cordis';
import type { InvokeRemoteRequest, TypertGateway } from '@deepseek-ai/dsh-api-gateway';
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/types';
import type { CommandResult } from '@deepseek-ai/dsh-commands/types';
import type { Workspace } from '@deepseek-ai/dsh-workspace/types';
import type { ModelCatalogView } from './core/verification.ts';
import type { ExecutionSummary, TaskRecord } from './core/tasks.ts';
import { type ExecutionFilePart, type ModelInfoResolver, type TaskBoardAttachmentStore } from './host/attachments.ts';
/**
 * Host services needed to validate a task's workspace before creating a
 * session, and to resolve the workspace an unpinned card runs in.
 */
export interface TaskBoardWorkspaceRegistry {
    list(): readonly Workspace[];
}
/**
 * The peer every gateway request names: derived from the public
 * `InvokeRemoteRequest` type so this package needs no direct dependency on
 * `@deepseek-ai/dsh-typert-protocol` for the shape.
 */
export type GatewayPeer = InvokeRemoteRequest['peer'];
interface GatewayRequest {
    namespace: string;
    method: string;
    args: Record<string, unknown>;
    peer: GatewayPeer;
    signal?: AbortSignal;
}
/**
 * Mint the in-process owner peer this plugin's Host calls speak for.
 *
 * The 0.2.1 gateway made `peer` mandatory on every request, and the
 * authorization layer reads only `peer.principal`: a principal of
 * `{ kind: 'owner' }` is how host-local code states that the call IS the local
 * user driving their own Host, so the gateway answers it directly instead of
 * running a remote-access decision (only non-owner principals are judged).
 * That is exactly the task board's position — it creates, renames, prompts,
 * and reads sessions as the Host itself, which before 0.2.1 was the implicit
 * privilege of every in-process caller. The board claims owner explicitly, and
 * only ever inside its own Host process: no wire field can set a principal,
 * and this plugin never forwards a browser-supplied one.
 *
 * `interactions` stays `'none'`: the board only invokes methods and opens the
 * short `session/follow` stream. The gateway's interactions check gates
 * exactly the forwarded-event endpoints (opening an event stream, answering a
 * waterfall), which this caller never touches; an `'answer'` peer would
 * additionally receive forwarded Host events, a capability the board neither
 * needs nor wants.
 *
 * The peer's signal aborts once `ctx` disposes, so streams opened for it end
 * with the plugin fiber, and `dispose()` is idempotent with racing calls
 * sharing one completion. The id carries no credential — the protocol fixes
 * `principal` as the only identity persisted in a session log — so a fresh
 * unique id per mount is sufficient.
 */
export declare function createOwnerPeer(ctx: Context): GatewayPeer;
interface SessionGateway {
    invoke(request: GatewayRequest): Promise<unknown>;
    stream?(request: GatewayRequest): Promise<AsyncIterable<unknown>>;
}
/** One session-list row consumed by task-board reconciliation. */
export type { SessionSummary };
type ExecutionSessionId = SessionSummary['sessionId'];
export interface SessionCommandDispatcher {
    execute(sessionId: ExecutionSessionId, line: string, signal: AbortSignal): Promise<CommandResult | undefined>;
}
export type ExecutionInspection = 
/**
 * No verdict yet. `unreadable` separates "the work may still be in progress"
 * from "this session's history could not be read at all": a reader failure is
 * not progress, and the caller decides how long to keep waiting before it
 * reports the execution as undeterminable instead of holding a card open
 * forever.
 */
{
    outcome: 'pending';
    unreadable?: true;
    reason?: string;
} | {
    outcome: 'succeeded';
    summary?: ExecutionSummary;
} | {
    outcome: 'failed';
    error: string;
    summary?: ExecutionSummary;
} | {
    outcome: 'cancelled';
    error: string;
    summary?: ExecutionSummary;
};
/** A post-create launch failure that still identifies the session to the ledger. */
export declare class SessionLaunchError extends Error {
    readonly sessionId: string;
    constructor(sessionId: string, cause: unknown);
}
/**
 * Compose the execution prompt (issue #6): a continuation card (one carrying
 * a frozen snapshot) has its instruction mandatorily wrapped in a source
 * declaration (freeze instant, source session, unreviewed-content warning)
 * templated by the board, so the picking-up agent stays wary of stored
 * prompt-instruction injection in card text (adversarial scenario c). The
 * wrap composes with the T4 handover preamble: the reference preamble comes
 * first, the provenance wrap then encloses the instruction. Plain tasks (no
 * freeze) keep the bare handover preamble + prompt.
 */
/** One unfinished subtask the launched card's own agent has to dispatch. */
export interface PromptDescendant {
    /** Task id of the subtask card. */
    id: string;
    /** Subtask title. */
    title: string;
    /** Its column, so the run can tell a fresh card from one already failed before. */
    status: string;
}
/** Execution-shape context appended to the launched task's prompt. */
export interface PromptContext {
    /**
     * The card's outstanding descendants. Present exactly when this run is an
     * autonomous dispatch: the Host opens no session for them, so this session
     * reads them and dispatches subagents itself.
     */
    descendants?: readonly PromptDescendant[];
    /**
     * Scheduled-run provenance: the instant the rule actually fired, its kind,
     * and the IANA zone its wall clock was read in. Present only for a
     * timer-triggered run, so the model can resolve an unqualified date in the
     * run's own terms instead of guessing from the Host clock (issue #1722).
     */
    schedule?: {
        triggeredAt: number;
        timeZone: string;
        mode: 'cron' | 'once';
        cron?: string;
    };
    /**
     * Rework provenance: the instructions a reviewer sent the previous run back
     * with. Present exactly when this execution continues the card's own session
     * to redo work, so the agent reads why it is being asked again instead of
     * seeing the card body a second time with no explanation.
     */
    rework?: {
        instructions: string;
    };
    /**
     * The card's attached files, resolved to readable host paths for THIS
     * execution. Present exactly when the card carries files: the section is a
     * preamble of its own, separate from the handover references, so the two
     * kinds of reference stay distinguishable to the reading agent.
     */
    files?: readonly ExecutionFilePart[];
}
/**
 * Build the execution prompt for one task.
 * @param task - the task being launched.
 * @param context - the run's other members, for the execution-shape section.
 * @returns the prompt text.
 */
export declare function promptText(task: TaskRecord, context?: PromptContext): string;
/**
 * Build the objective the built-in `/goal` command receives. A prompt whose
 * text would be read as a goal operation is prefixed with a neutral label: the
 * instruction stays intact, and the command arms an objective instead of
 * clearing, pausing, or editing an unrelated goal (or refusing for a missing
 * one).
 * @param prompt - the composed execution prompt.
 * @returns the objective text for `/goal <objective>`.
 */
export declare function goalObjective(prompt: string): string;
/**
 * The optional runtime faces an execution needs beyond the session gateway:
 * the official attachment storage and the model-info reader the image
 * preflight uses. Both are read live, so a deployment that mounts them after
 * the board still gains the capability.
 */
export interface TaskBoardRuntimeFaces {
    /** The official attachment storage, or undefined when the deployment has none. */
    attachments?: () => TaskBoardAttachmentStore | undefined;
    /** The model-info reader, or undefined when the deployment serves no model information. */
    llm?: () => ModelInfoResolver | undefined;
    /**
     * Whether this deployment runs the legacy Agent Teams runtime, read live
     * from the agent tool registry. Absent, or answering false, means the
     * deployment is not PROVEN legacy: the dispatcher preset is then forced as
     * before. Only a positive answer refuses the run, so a deployment whose
     * registry cannot be read keeps its current behaviour instead of losing the
     * ability to dispatch a subtask tree.
     */
    legacyAgentTeams?: () => boolean;
}
export declare class HostExecutionRunner {
    private readonly gateway;
    private readonly commands?;
    private readonly workspaceRegistry?;
    private readonly faces;
    /**
     * Newest event sequence per session whose COMPLETE history walk (reaching
     * the execution boundary) found no matching execution end. A later walk may
     * trust everything at or below it and examine only newer records.
     */
    private readonly scanMemos;
    private readonly unavailableAttempts;
    private readonly unavailableBackoffMs;
    /**
     * The peer every request speaks for. Production passes the peer bound to the
     * plugin fiber; a bare runner (unit tests around fake gateways) gets one
     * bound to a fresh root context instead.
     */
    private readonly ownerPeer;
    private unsupportedSessionListWarned;
    constructor(gateway: SessionGateway | TypertGateway, commands?: SessionCommandDispatcher | undefined, workspaceRegistry?: TaskBoardWorkspaceRegistry | undefined, unavailableRetry?: {
        attempts?: number;
        backoffMs?: number;
    }, ownerPeer?: GatewayPeer, faces?: TaskBoardRuntimeFaces);
    private invoke;
    private stream;
    /**
     * The workspace an unpinned run lands in: the deployment's most recently used
     * one. Undefined when the deployment serves no workspace registry or has
     * registered none yet; the launch then keeps the "let the Host decide" shape,
     * which is the only remaining path to the Host's own working directory.
     * @returns the workspace id to create the session in, when one is known.
     */
    private recentWorkspaceId;
    /**
     * Launch one execution. Without `options.reuseSessionId` a fresh session is
     * created, renamed, pinned, and prompted (the historical contract). With it,
     * the run continues in that existing session (issue #1419): the conversation
     * keeps its title and history, the pinned permission/model are re-asserted so
     * the task's execution contract still holds, and the prompt is queued.
     * @param task - the task to run.
     * @param options - optional session to continue in.
     * @returns the session id the execution runs in.
     */
    launch(task: TaskRecord, options?: {
        reuseSessionId?: string;
        promptContext?: PromptContext;
        /**
         * Agent preset this execution is FORCED under, overriding the card's own
         * `mode` pin (and a handover bundle's): the caller decides it from the run's
         * shape (a card with unfinished subtasks runs as the autonomous dispatcher),
         * and the override is never written into the card. A preset the deployment
         * does not register fails the launch before any session exists.
         */
        agentPreset?: string;
        onSession?: (sessionId: string) => void;
        onGoalArmed?: (armed: boolean) => void;
        /**
         * GLOBAL native /goal switch, resolved by the caller ONCE per execution and
         * carried here so the decision is frozen for this launch.
         *
         * Frozen deliberately: a settings edit made while the run is in flight must
         * not arm, disarm or otherwise change the goal/acceptance contract of a run
         * already running. Absent means off — the default for every deployment that
         * never touched the switch, including cards written before the option
         * existed. A plain single turn is what an off switch produces; the task-level
         * `goalRun` still applies on top of it (both must ASK for a goal).
         */
        goalEnabled?: boolean;
        /**
         * The host model catalog, read ONCE per execution by the caller. The card's
         * pinned reasoning effort is sent only when this catalog declares it for the
         * route the execution runs at, so one snapshot decides both the acceptance
         * contract and the effort this run freezes. Absent means "no capability
         * evidence": an effort is then not sent at all.
         */
        catalog?: ModelCatalogView;
    }): Promise<string>;
    /**
     * Queue one follow-up user message into an existing execution session.
     *
     * This is the same `session/prompt` call a launch makes, with none of the
     * launch pins: a follow-up continues a conversation the board already
     * composed, so it must not re-assert the permission, rename the session, or
     * switch the model. The message is queued behind whatever that session is
     * doing, which is what lets a caller reach a run that is still working.
     * @param sessionId - the session the card's execution recorded.
     * @param text - the message to deliver, already validated by the caller.
     */
    followUp(sessionId: string, text: string): Promise<void>;
    /**
     * Fail closed when a reused session records a different Agent preset than
     * the one this task pins.
     *
     * The fresh branch asserts the pin by passing `agentPreset` to
     * `session/create`; the reuse branch must not call that method (it would
     * create or re-adopt the very session the board only meant to continue), so
     * the recorded value is read through `session/projections` — the documented
     * read that resolves no Agent — and compared here (issue #1708). A session
     * whose preset cannot be read is not treated as a match: silently continuing
     * under an unknown composition is the failure this guards.
     * @param sessionId - the session this execution continues in.
     * @param pinned - the preset id the task pins, when it pins one.
     */
    private assertReusedPreset;
    /**
     * Split a `provider/model` pin. A pin without a provider keeps only the model
     * id: the provider is the one the host catalog declares for it, resolved at
     * launch because the session wire contract requires a provider.
     */
    private static pinnedRoute;
    /**
     * The route a card that pins no model actually runs at: the session's own
     * recorded selection (the durable fold the GUI reads; `next` is the pending
     * user choice, `lastUsed` what the last request consumed), or — for a session
     * that has selected none yet, which is exactly a session that would start at
     * the deployment default — the host default from the catalog.
     *
     * A route that cannot be READ is undefined and the effort is not sent:
     * falling back to the host default there would silently switch the model of a
     * session this run only meant to continue.
     */
    private sessionRoute;
    /**
     * Re-assert the pinned execution contract on a session and queue the task
     * prompt. Shared by the fresh-session and reuse paths so both apply exactly
     * the same permission/model/effort pins before the prompt. A session that
     * refuses a selection carrying a catalog-confirmed effort throws here, so the
     * prompt is never queued behind a run at the wrong level.
     */
    private pinAndPrompt;
    /**
     * Resolve a card's attachments for one execution.
     *
     * A card without attachments resolves to nothing, even in a deployment that
     * serves no attachment storage at all. A card WITH attachments cannot run
     * without the storage: the run fails with a readable reason instead of
     * silently dropping the attachment and running the card as if it carried
     * none.
     */
    private resolveAttachments;
    /**
     * Read the host's model catalog: the default route an unconfigured session
     * starts at, and each provider's models with the reasoning metadata its
     * adapter exposes. The acceptance settings card and the frozen contract both
     * resolve against it, so "inherit host" means the host's own configuration
     * rather than a session's or a card's pinned model.
     * @returns the raw catalog value, or undefined when this cohort serves none.
     */
    modelCatalog(): Promise<unknown>;
    /**
     * Arm dsh's built-in goal on the session. The task prompt is queued FIRST, so
     * the session's first turn carries the instruction verbatim; `/goal
     * <objective>` then turns the same text into a persistent objective, and
     * dsh's goal-round driver keeps starting continuation rounds until the agent
     * marks it complete (see {@link goalVerdict} for how the run settles).
     *
     * Two switches gate the arming, and BOTH must ask for it:
     * - the GLOBAL native-/goal switch (`goalEnabled`, default OFF), frozen when
     *   this execution started; and
     * - the task's own `goalRun` (absent means off, only an explicit true opts
     *   the card into a goal run).
     *
     * A refusal (no command dispatcher, no `/goal` command in this cohort, an
     * objective the command rejects) is reported and the run continues as a plain
     * turn: the task was asked to run, and a missing goal mode must not lose the
     * work.
     * @param sessionId - the session to arm in.
     * @param task - the task being run.
     * @param context - the run's prompt context.
     * @param goalEnabled - the GLOBAL switch, frozen for this execution.
     * @returns whether `/goal` was really armed.
     */
    private armGoal;
    /**
     * The verdict an armed dsh goal imposes on an otherwise completed turn.
     *
     * A goal run is one session working many automatic continuation rounds:
     * dsh's goal-round driver queues the next round whenever the agent goes
     * idle, so the first completed `turn/end` is not the execution's result.
     * Settling there would leave the card in `done` while the session keeps
     * working, and a scheduled task would fire a second, concurrent session.
     * The session projection is the authority: an `active` goal keeps the
     * execution pending, a `blocked` goal fails it with the recorded reason, and
     * any other phase (complete, paused, or no goal at all) leaves the turn
     * verdict in place.
     *
     * An unreadable projection falls back to that turn verdict: a cohort whose
     * gateway withdrew `session/projections` must not hang every execution.
     */
    private goalVerdict;
    listRunning(): Promise<{
        known: true;
        count: number;
        items: SessionSummary[];
    } | {
        known: false;
    }>;
    /**
     * Resolve an execution outcome from the session list and bounded history pages.
     * @param sessionId - the session the execution runs in.
     * @param startedAt - instant the execution opened; earlier events are not its own.
     * @param sessions - roster from the caller's own poll, when it already has one.
     * @param options.whileRunning - read the first completed turn even while the
     *   roster reports the session as running. A durable Agent Teams teammate
     *   stays alive after its turn ends, so `running` never clears for it and the
     *   turn it completed is the only verdict it will ever expose.
     */
    inspect(sessionId: string, startedAt?: number, sessions?: readonly SessionSummary[], options?: {
        whileRunning?: boolean;
    }): Promise<ExecutionInspection>;
}
