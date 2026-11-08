/**
 * Subtask lineage: the depth gate, the ancestry/descendant queries, the
 * outstanding-descendant decision one run request makes, the deferred
 * settlement of a historical run group, and the execution-target inheritance a
 * subtask resolves at run time.
 *
 * Framework-free (no cordis, no runtime imports) so every rule is
 * unit-testable in isolation. The Host ledger is the only authority; the
 * browser mirrors these predicates to enable or disable controls, never to
 * decide them.
 */
import type { ExecutionOutcome, ExecutionRecord, TaskRecord } from './tasks.ts';
/** Lowest configurable subtask depth. */
export declare const SUBTASK_DEPTH_MIN = 1;
/** Highest configurable subtask depth. */
export declare const SUBTASK_DEPTH_MAX = 3;
/** Deployment default: one level of subtasks, and no subtask of a subtask. */
export declare const DEFAULT_SUBTASK_DEPTH = 1;
/**
 * Clamp a configured depth into the supported range. Anything unusable
 * (absent, non-numeric, not finite) falls back to the default, so a bad
 * configuration narrows the tree instead of lifting the guard.
 */
export declare function normalizeSubtaskDepth(value: unknown): number;
/** Whether an unknown value is a settled execution outcome. */
export declare function isExecutionOutcome(value: unknown): value is ExecutionOutcome;
/**
 * Reusable lineage index over ONE task list: the id lookup and the direct
 * children per parent. A caller that runs several lineage queries over the same
 * ledger (the link-subtask candidate gate runs one per task) builds this once
 * instead of rescanning the list per query.
 */
export interface LineageIndex {
    readonly byId: ReadonlyMap<string, TaskRecord>;
    readonly childrenByParent: ReadonlyMap<string, readonly TaskRecord[]>;
}
/** Build the reusable index for a task list (ledger order preserved). */
export declare function buildLineageIndex(tasks: readonly TaskRecord[]): LineageIndex;
/**
 * Nearest-first ancestor chain of a task. The walk is cycle-safe and bounded
 * by the ledger size rather than by the deployment maximum: a chain stored
 * under a larger limit survives that limit being lowered, and restore and
 * inheritance must still see all of it.
 */
export declare function ancestorChain(tasks: readonly TaskRecord[], task: TaskRecord, lineage?: LineageIndex): TaskRecord[];
/** Root-to-task depth: a root task is 0, its subtask 1, and so on. */
export declare function taskDepth(tasks: readonly TaskRecord[], id: string, lineage?: LineageIndex): number;
/** Direct subtasks of a task, in ledger order. */
export declare function directSubtasks(tasks: readonly TaskRecord[], id: string, lineage?: LineageIndex): TaskRecord[];
/**
 * Descendants of a task in breadth-first order, bounded by maxSubtaskDepth
 * total depth. The visited set keeps a malformed ledger from looping.
 */
export declare function descendantTasks(tasks: readonly TaskRecord[], id: string, maxSubtaskDepth: number, lineage?: LineageIndex): TaskRecord[];
/**
 * Height of a task's own subtree (0 for a leaf), bounded by the hard maximum.
 * The visited set makes the walk terminate on a cyclic hand-edited ledger
 * instead of recursing until the stack overflows.
 */
export declare function subtreeHeight(tasks: readonly TaskRecord[], id: string, visited?: ReadonlySet<string>, lineage?: LineageIndex): number;
/** Why a parent link was refused; also the source of the Host error text. */
export type ParentLinkRejection = 'unknown-task' | 'unknown-parent' | 'archived-parent' | 'self-parent' | 'cycle' | 'depth-exceeded';
export interface ParentLinkCheck {
    /** True when the link (or the detachment) may be stored. */
    ok: boolean;
    /** Why it was refused; absent when ok. */
    reason?: ParentLinkRejection;
}
/**
 * Whether childId may be attached under parentId. A null parent detaches and
 * is always allowed for a known task. Otherwise the link must name an
 * on-board task that is neither the child itself nor one of its descendants,
 * and the resulting depth (parent depth + 1 + the child own subtree height)
 * must stay within maxSubtaskDepth.
 */
export declare function checkParentLink(tasks: readonly TaskRecord[], childId: string, parentId: string | null, maxSubtaskDepth: number, lineage?: LineageIndex): ParentLinkCheck;
/**
 * The tasks one run request opens executions for: the requested card ALONE.
 *
 * Running a card never expands into its subtask tree. The card's own session
 * reads its subtasks through the board tools and dispatches subagents itself,
 * so a parent run opens exactly one session. Clicking a subtask runs that
 * subtask as its own root, again without expanding its own descendants. The
 * lineage queries around this one answer questions about the tree the card's
 * agent works with (who is still outstanding, what a historical run group
 * still holds open) — never who gets a session from the Host.
 * @param tasks - the ledger.
 * @param rootId - the task the run request named.
 * @returns the one card this run opens an execution for, or [] when unknown.
 */
export declare function cascadeTargets(tasks: readonly TaskRecord[], rootId: string): TaskRecord[];
/**
 * A task together with every descendant within the configured depth: the
 * subtree a lineage gate (archive, restore, force-close) has to walk.
 */
export declare function subtreeTasks(tasks: readonly TaskRecord[], id: string, maxSubtaskDepth: number): TaskRecord[];
/**
 * Whether a card still has work outstanding: anything outside the `done`
 * column. It keys on the column alone, so it covers both a subtask that ran
 * and one an operator moved to done by hand.
 */
export declare function isOutstanding(task: TaskRecord): boolean;
/**
 * The descendants of a card that still have work outstanding, in breadth-first
 * order: the cards its own session is expected to dispatch. An archived
 * descendant is off the board and cannot be dispatched, so it is not listed.
 */
export declare function outstandingDescendants(tasks: readonly TaskRecord[], rootId: string, maxSubtaskDepth: number): TaskRecord[];
/**
 * Whether any descendant of this card still sits outside the `done` column.
 * This is the ONE decision behind both the forced agent preset and the dispatch
 * section of the execution prompt: a card whose tree still holds work runs as
 * the autonomous dispatcher.
 */
export declare function hasOutstandingDescendants(tasks: readonly TaskRecord[], rootId: string, maxSubtaskDepth: number): boolean;
/**
 * Agent preset a run with unfinished subtasks is forced under. The id comes
 * from packages/dsh-liangshen (its own `LIANGSHEN_PRESET_ID`); the force is
 * applied at launch and never written into a card's `mode` field.
 */
export declare const LIANGSHEN_PRESET_ID = "liangshen";
/**
 * The tool a legacy Agent Teams runtime registers, and the one fingerprint
 * this board reads off a deployment: the pre-#7519 generation registers
 * `spawn_teammate` and replaces `send_message` / `list_agents` /
 * `interrupt_agent` with team-scoped variants, so children exist but are
 * unreachable. The current runtime adds a shared task board instead and reuses
 * the coordination tools, so those three names prove nothing and are never
 * gated on (the criterion is the same one
 * `packages/dsh-liangshen/presets/liangshen/dispatcher-rules.mjs` states).
 */
export declare const LEGACY_AGENT_TEAMS_TOOL = "spawn_teammate";
/**
 * The failure text the Host records when a run would have been forced under
 * the dispatcher preset on a deployment that cannot orchestrate.
 *
 * A finished sentence rather than a code (the shape `core/workspace-target.ts`
 * gives its missing-workspace refusal): the ledger stores it as the
 * execution's failure text, the agent tools serve it to a model, and any
 * client prints it verbatim. It names the fix, not the mechanism. The launch
 * is refused before any session exists, because the dispatcher preset would
 * otherwise stop and wait for a human reply that an unattended run never
 * brings.
 */
export declare const LEGACY_AGENT_TEAMS_REASON: string;
/**
 * Whether a recorded failure text is the legacy-runtime refusal, which the
 * browser half renders in the reader's own language.
 * @param reason - the execution's recorded failure text.
 * @returns true when that run was refused for a deployment that cannot orchestrate.
 */
export declare function isLegacyAgentTeamsReason(reason: string): boolean;
/**
 * Whether a card belongs to a run's dispatch set: the card the request named,
 * or a card whose work is still outstanding. Kept for the browser's subtask
 * preview; the Host run itself opens the clicked card alone
 * ({@link cascadeTargets}).
 * @param task - the candidate card.
 * @param rootId - the task the run request named.
 * @returns false when this card is finished and left alone.
 */
export declare function joinsCascadeRun(task: TaskRecord, rootId: string): boolean;
/** One still-open execution belonging to a stored run group. */
export interface OpenCascadeChild {
    taskId: string;
    execution: ExecutionRecord;
}
/** The open execution of a task inside a run group, if it still exists. */
export declare function openGroupExecution(task: TaskRecord, runGroupId: string): ExecutionRecord | undefined;
/**
 * The direct subtasks of parentTaskId whose execution in this run group is
 * still open: the parent's remaining waiters. A stored multi-member group (a
 * run the Host opened before it stopped spreading one run across a subtree)
 * folds once this list is empty and the parent's own outcome is known.
 */
export declare function pendingCascadeChildren(tasks: readonly TaskRecord[], parentTaskId: string, runGroupId: string): OpenCascadeChild[];
/**
 * Fold a stored run-group parent's own outcome and its children's outcomes into
 * one verdict: failure dominates, then cancellation, then success. The error
 * text is the first failure, falling back to the first cancellation.
 */
export declare function combineCascadeOutcome(entries: readonly {
    result: ExecutionOutcome;
    error?: string;
}[]): {
    result: ExecutionOutcome;
    error: string | undefined;
};
/**
 * The permission a task would actually run under: its handover bundle's pin
 * wins over the plain pin field, exactly as the runner resolves it.
 */
export declare function effectiveTaskPermission(task: TaskRecord): TaskRecord['permission'];
/**
 * Resolve the execution targets a (sub)task actually runs with: its own value
 * wins, and an unset target inherits the nearest ancestor up to the root.
 * Workspace, agent preset, model and reasoning effort inherit the ancestor's
 * PIN only — a handover bundle is a per-card continuation artefact and is never
 * inherited. The permission inherits the ancestor's EFFECTIVE binding, and its
 * human confirmation travels with it, so a subtask of an already-confirmed
 * elevated card is runnable while a subtask's own unconfirmed binding stays
 * gated.
 */
export declare function resolveExecutionTargets(task: TaskRecord, tasks: readonly TaskRecord[], maxSubtaskDepth?: number): TaskRecord;
