/**
 * Board controller: the single owner of task-ledger state and view state.
 *
 * In production it projects the Host ledger and submits confirmed actions;
 * the legacy store seam remains for v1 migration tests. The board closes
 * only on explicit user navigation, never implicitly on session-list churn.
 * Framework-free (structural runtime faces) so the whole orchestration is
 * unit-testable with fakes.
 *
 * The per use-case domain transitions (create/update/delete/schedule) live in
 * dedicated modules under core/use-cases and are applied here; the controller
 * owns only the orchestration seam (state, persistence, notify, navigation).
 */
import type { TaskStore } from './store.ts';
import { type NewTaskInput, type TaskRecord, type TaskStatus } from './tasks.ts';
import { type SetSchedulePatch } from './use-cases/task-schedule.ts';
import { type TaskUpdatePatch } from './use-cases/task-update.ts';
import type { TaskBoardAction, TaskBoardEventPayload, TaskBoardParseDraft, TaskBoardParseRequest, TaskBoardSnapshot } from '../protocol.ts';
import type { TaskBoardExtensionActionRequest, TaskBoardVisibilityPredicate } from './extension.ts';
export interface TaskBoardTransport {
    bootstrap(legacy: readonly TaskRecord[]): Promise<TaskBoardSnapshot>;
    state(): Promise<TaskBoardSnapshot>;
    /**
     * Submit one action; the optional initiator is the current DSH session id
     * (issue #6 audit origin), asserted by the client and recorded by the Host.
     */
    action(action: TaskBoardAction, initiator?: string): Promise<TaskBoardSnapshot>;
    subscribe(listener: (event?: TaskBoardEventPayload) => void): () => void;
    /**
     * One-shot model parse of pasted text (issue #1540). Optional: a deployment
     * that cannot parse simply omits it, and the form hides the section.
     */
    parseDraft?(request: TaskBoardParseRequest, signal?: AbortSignal): Promise<TaskBoardParseDraft>;
}
/**
 * The sessions face the controller needs for navigation awareness. The Client
 * Session Controller carries no global selection since 0.1.6-alpha.2, so the
 * wiring resolves the main-view Session once and exposes it as current().
 */
export interface SessionsControllerFace {
    /** The Session the main view currently shows, when any. */
    current(): string | undefined;
    /** Navigate the main view to a Session. */
    open(id: string): void;
    /** Subscribe to catalog changes; selection ownership rides the same snapshot. */
    subscribe(fn: () => void): () => void;
}
/** Stable id shared by the board's sidebar panel row and its main-slot page. */
export declare const TASK_BOARD_PANEL_ID = "task-board";
/**
 * The layout's panel-navigation face. The board no longer owns the center
 * column at the DOM level: selecting the panel is the layout's business, and
 * this is the one call that asks for it (null returns to the conversation).
 * Optional, so a composition without the layout service keeps the board's
 * pure state transitions testable.
 */
export interface PanelNavigationFace {
    /** Select the board panel, or null to hand the column back to the conversation. */
    select(panelId: string | null): void;
}
/** Controller dependencies (all swappable in tests). */
export interface ControllerDeps {
    store: TaskStore;
    sessions: SessionsControllerFace;
    /** Clock; defaults to Date.now. */
    now?: () => number;
    /** Id minting; defaults to a random-uuid. */
    uuid?: () => string;
    /** Host-authoritative transport; absent keeps the legacy in-memory test path. */
    transport?: TaskBoardTransport;
    /** Layout panel selection; absent keeps the board state-only (tests, shell-less hosts). */
    panel?: PanelNavigationFace;
}
/**
 * Register one host directory as a DSH project (workspace). Wired by the
 * browser apply() to the runtime's workspace controller; without it the board
 * hides its "new project" action instead of offering a dead control (#1536).
 */
export type WorkspaceCreator = (path: string) => Promise<{
    workspaceId: string;
}>;
/** One workspace option the execution-target pickers offer. */
export interface ExecutionWorkspaceOption {
    workspaceId: string;
    /** Display label (workspace title; the wiring falls back to the path). */
    title: string;
}
/** One agent-preset option the execution-target pickers offer. */
export interface ExecutionPresetOption {
    id: string;
    name?: string;
    description?: string;
    /** Why this preset cannot compose a session; the pickers disable it. */
    broken?: string;
    isDefault: boolean;
}
/** One model option the execution-target pickers offer. */
export interface ExecutionModelOption {
    id: string;
    name?: string;
    label?: string;
    provider?: string;
}
/** The execution-target option sets the UI feeds into the controller. */
export interface ExecutionOptionsSnapshot {
    workspaces: readonly ExecutionWorkspaceOption[];
    presets: readonly ExecutionPresetOption[];
    models?: readonly ExecutionModelOption[];
}
/**
 * Host-owned state the browser mirrors. SSE frames carry the volatile subset
 * (revision/scheduler/power); a full snapshot also carries the deployment
 * constants the UI reads (session default permission, subtask depth).
 */
export type HostMirror = Pick<TaskBoardSnapshot, 'revision' | 'scheduler' | 'power' | 'sessionDefaultPermission' | 'maxSubtaskDepth' | 'teamRunAvailable' | 'goalRunEnabled' | 'extensions'>;
/** Immutable controller snapshot for UI subscriptions. */
export interface ControllerSnapshot {
    tasks: readonly TaskRecord[];
    boardOpen: boolean;
    /** True when the board shows the archive view instead of the columns. */
    archiveView: boolean;
    selectedTaskId: string | undefined;
    /** Picker option sets (workspace list + agent-preset roster). */
    executionOptions: ExecutionOptionsSnapshot;
    pendingTaskIds: readonly string[];
    /** Whether the board may offer "register a new project" (issue #1536). */
    canCreateWorkspace?: boolean;
    /** Whether this deployment can parse pasted text into task fields (issue #1540). */
    canParseTask?: boolean;
    transportError?: string;
    host?: HostMirror;
    /**
     * Provider card-visibility predicates, in registration order. A task shows
     * only while every predicate accepts it; providers hide their own off-board
     * cards here instead of the board hard-coding a provider rule. Optional so a
     * hand-built snapshot (tests, a shell-less composition) defaults to visible.
     */
    visibility?: readonly TaskBoardVisibilityPredicate[];
    /** Read-only summaries published by running extensions, keyed by extension id. */
    extensions?: Readonly<Record<string, unknown>>;
}
/** The selected task (resolved from the ledger), or undefined. */
export declare function selectedTaskOf(snapshot: ControllerSnapshot): TaskRecord | undefined;
/**
 * Board controller (see module doc). All mutations bump the snapshot and
 * persist through the store; UI and DOM mounts subscribe and re-render.
 */
export declare class BoardController {
    private readonly deps;
    private tasks;
    private boardOpen;
    private archiveView;
    private selectedTaskId;
    private executionOptions;
    private workspaceCreator;
    private listeners;
    private disposers;
    private readonly now;
    private readonly uuid;
    private readonly pendingTaskIds;
    private readonly taskQueues;
    private transportError;
    private hostState;
    /** Provider visibility predicates (immutable array; replaced on change). */
    private visibility;
    private remoteSubscribed;
    private remoteInitialization;
    /** @param deps - store and the sessions navigation face. */
    constructor(deps: ControllerDeps);
    /** Load the persisted ledger and start the navigation/status subscriptions. */
    start(): void;
    /** Stop all subscriptions and drop retained state (idempotent). */
    dispose(): void;
    getSnapshot(): ControllerSnapshot;
    /**
     * Register one card-visibility predicate. The returned disposer removes it;
     * both changes notify subscribers so the board re-renders.
     */
    registerVisibility(predicate: TaskBoardVisibilityPredicate): () => void;
    /**
     * Deliver one provider action through the board's same-origin channel. A
     * board without a Host transport (the legacy in-memory path) refuses it.
     */
    dispatchExtension(request: TaskBoardExtensionActionRequest): Promise<boolean>;
    subscribe(fn: () => void): () => void;
    /** Whether production mutations are confirmed by the Host transport. */
    isHostBacked(): boolean;
    /** Retry initial migration/state synchronization after an explicit Host error. */
    retryHostSync(): Promise<boolean>;
    /**
     * Show the board. The layout owns which panel the center column renders, so
     * the state flip and the panel selection travel together here; a composition
     * with no layout face (tests, a shell-less host) still flips the state.
     *
     * The selection is requested AFTER the snapshot flips so a subscriber
     * rendering against `boardOpen` never observes "open" while the shell still
     * shows the conversation.
     */
    openBoard(): void;
    /**
     * Return the center column to the conversation. The layout's own selection is
     * the source of truth for what the column renders, so this asks for the
     * conversation explicitly rather than only clearing local state.
     */
    closeBoard(): void;
    toggleBoard(): void;
    /**
     * Reflect a panel selection that came from OUTSIDE this controller (the user
     * clicked another sidebar row, or the layout dropped the panel id). Keeps
     * `boardOpen` aligned with what the column actually shows without asking the
     * layout to select anything back.
     * @param panelId - the layout's current panel id, or null for the conversation.
     */
    syncPanelSelection(panelId: string | null): void;
    /** Ask the layout to select a panel; a shell that serves no layout face is a no-op. */
    private selectPanel;
    /**
     * Switch between the kanban columns and the archive view. Leaving the
     * archive view with an archived task still selected closes the selection —
     * the detail overlay must not linger over a task that is off-board.
     */
    toggleArchiveView(): void;
    openTask(id: string): void;
    closeTask(): void;
    createTask(input: NewTaskInput): TaskRecord | undefined;
    /** Create through the Host and expose the task only after confirmation. */
    createTaskConfirmed(input: NewTaskInput): Promise<TaskRecord | undefined>;
    /**
     * Apply an editable-field patch (task content + execution targets).
     * Host-backed: the Host ledger owns the fail-closed checks (the content of
     * an executed task is read-only) and confirms the mutation, so the resolved
     * value reflects whether the Host accepted it; the legacy in-memory path
     * applies and persists synchronously.
     * @returns true when the patch was accepted by the authority.
     */
    updateTask(id: string, patch: TaskUpdatePatch): Promise<boolean>;
    /**
     * Replace (a part of) the picker option sets the UI feeds (workspace list
     * and agent-preset roster come from the runtime, not the ledger).
     */
    setExecutionOptions(patch: Partial<ExecutionOptionsSnapshot>): void;
    /** Wire (or clear) the runtime's project registration face (issue #1536). */
    setWorkspaceCreator(creator: WorkspaceCreator | undefined): void;
    /**
     * Register an existing host directory as a DSH project, exactly as the GUI's
     * own "add project" does; the runtime's failure message surfaces unchanged.
     */
    createWorkspace(path: string): Promise<{
        workspaceId: string;
    }>;
    /** Whether this deployment can parse pasted text into task fields (issue #1540). */
    canParseTask(): boolean;
    /**
     * Parse pasted text into task fields through the Host. The transport already
     * phrases every failure for the user, so its message surfaces unchanged.
     */
    parseTaskDraft(request: TaskBoardParseRequest, signal?: AbortSignal): Promise<TaskBoardParseDraft>;
    moveTask(id: string, status: TaskStatus): void;
    deleteTask(id: string): void;
    /**
     * Archive a task from any status but `running`, whose lifecycle the runner
     * keeps exclusive ownership of until it settles.
     * @returns true when applied.
     */
    archiveTask(id: string): boolean;
    /**
     * Attach an existing task under a parent (or detach it with a null parent)
     * through the Host. The lineage gate — parent exists and is on-board, no
     * cycle, depth within the deployment limit — belongs to the Host; a refusal
     * surfaces through the transport error like every other rejected action.
     * @returns true when the link was accepted by the authority.
     */
    setParent(id: string, parentId: string | null): Promise<boolean>;
    /** Restore an archived task back onto the board (same status column). */
    restoreTask(id: string): boolean;
    /**
     * Rename one label across the whole ledger; a name already in use merges the
     * two labels. Host-backed: the ledger owns the transition and confirms it, so
     * the board's label row reflects whether the Host accepted the edit.
     * @returns true when the edit was accepted by the authority.
     */
    renameTag(from: string, to: string): Promise<boolean>;
    /**
     * Remove one label from every task that carries it, board and archive alike —
     * the board's label row is drawn from the whole ledger, so a label left on an
     * archived card would come straight back.
     * @returns true when the edit was accepted by the authority.
     */
    deleteTag(name: string): Promise<boolean>;
    /**
     * Update a task's schedule rule. An unusable plan (blank or invalid cron, a
     * one-shot with no future instant, a non-positive run cap) is rejected
     * (returns false, state untouched). When the rule ends up enabled the next
     * run instant is computed immediately — a one-shot's next instant IS its
     * planned instant — and a disabled rule carries none. Delegates the domain
     * transition to the schedule use case.
     * @param id - the task to schedule.
     * @param patch - fields to change (absent fields keep their current value).
     * @returns true when applied, false when rejected (unknown task / unusable plan).
     */
    setSchedule(id: string, patch: SetSchedulePatch): boolean;
    /**
     * Legacy pure-controller seam retained for migration-focused tests. The
     * production browser never rolls schedules; the Host ledger owns them.
     */
    applyScheduleNextRun(id: string, nextRunAt: number | undefined, lastTriggeredAt: number | undefined): void;
    /**
     * Reload the legacy v1 store without notifying subscribers. Production v2
     * reads Host snapshots instead; this remains only for isolated legacy tests.
     */
    reloadFromStore(): void;
    /**
     * Jump to an execution's session transcript. Selecting the session changes
     * `current`, which closes the board (the conversation view takes over).
     * @param sessionId - the execution session to open.
     */
    openSession(sessionId: string): void;
    /**
     * Request a Host execution for a task: the Host ledger owns the running
     * transition, the execution record, and the settlement. A second call
     * while the task is already running is ignored; without a Host transport
     * the run is refused (returns false).
     */
    runTask(id: string): Promise<boolean>;
    /**
     * Confirm a card's above-default permission binding through the Host
     * (resolves the pending-confirmation transaction; no-op otherwise).
     */
    confirmPermission(id: string): Promise<boolean>;
    /** Re-run a settled task through the Host (the Host replans and executes). */
    rerunTask(id: string): Promise<void>;
    /**
     * Session-list notifications fire for all kinds of incidental churn
     * (background navigation, the Host runner creating and selecting a fresh
     * execution session, settlement, other plugins), so closing on `current`
     * changes would evict the board without the user asking. The board closes
     * only on explicit user navigation: selecting another panel (the layout owns
     * selection, and `syncPanelSelection` follows it) or the board's own actions
     * (openSession / close). Keeping the hook preserves the subscription
     * contract for future listeners.
     */
    private onSessionsChanged;
    private persistAndNotify;
    private commitRemote;
    private performRemote;
    private initializeRemote;
    private doInitializeRemote;
    /**
     * SSE frames carry revision/scheduler/power. When the revision matches the
     * one already applied, apply the frame's scheduler/power in place and skip
     * the full /state fetch; otherwise the 5 s heartbeat would re-clone and
     * re-serialize the whole ledger per tab even while nothing changes.
     */
    private onRemoteEvent;
    /**
     * Deployment subtask depth limit the browser mirrors from the last Host
     * snapshot; the fallback is the deployment default for the legacy path (no
     * transport) and for the window before the first snapshot arrives.
     */
    private mirrorDepth;
    /**
     * Project a Host snapshot onto the browser's mirror. SSE frames and partial
     * snapshots carry only the volatile subset (revision/scheduler/power), so the
     * deployment constants the UI reads — the session-default permission the
     * confirmation banner compares against and the subtask depth limit — are
     * carried over from the last full snapshot instead of being dropped by a
     * heartbeat frame.
     */
    private mirrorOf;
    private refreshRemote;
    private acceptRemote;
    private notify;
}
