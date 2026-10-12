import type { TypertGateway } from '@deepseek-ai/dsh-api-gateway';
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/types';
import type { CommandResult } from '@deepseek-ai/dsh-commands/types';
import type { Workspace } from '@deepseek-ai/dsh-workspace/types';
import type { TaskRecord } from './core/tasks.ts';
/**
 * Host services needed to validate a task's workspace before creating a
 * session, and to resolve the workspace an unpinned card runs in.
 */
export interface TaskBoardWorkspaceRegistry {
    list(): readonly Workspace[];
}
interface GatewayRequest {
    namespace: string;
    method: string;
    args: Record<string, unknown>;
    signal?: AbortSignal;
}
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
} | {
    outcome: 'failed';
    error: string;
} | {
    outcome: 'cancelled';
    error: string;
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
/** One other execution member of a run, as named in the launched task's prompt. */
export interface PromptPeer {
    /** Task id of the member. */
    id: string;
    /** Member title. */
    title: string;
    /** Teammate name when this member runs as a teammate. */
    name?: string;
}
/** Execution-shape context appended to the launched task's prompt. */
export interface PromptContext {
    /** The other members this run opens, excluding the launched task itself. */
    peers?: readonly PromptPeer[];
    /** True when those members run as teammates inside this session (Team Lead). */
    team?: boolean;
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
export declare class HostExecutionRunner {
    private readonly gateway;
    private readonly commands?;
    private readonly workspaceRegistry?;
    /** Newest scanned event sequence per session with no matching execution end. */
    private readonly scanMemos;
    private readonly unavailableAttempts;
    private readonly unavailableBackoffMs;
    private unsupportedSessionListWarned;
    constructor(gateway: SessionGateway | TypertGateway, commands?: SessionCommandDispatcher | undefined, workspaceRegistry?: TaskBoardWorkspaceRegistry | undefined, unavailableRetry?: {
        attempts?: number;
        backoffMs?: number;
    });
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
    }): Promise<string>;
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
     * Re-assert the pinned execution contract on a session and queue the task
     * prompt. Shared by the fresh-session and reuse paths so both apply exactly
     * the same permission/model pins before the prompt.
     */
    private pinAndPrompt;
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
