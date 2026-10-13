/**
 * Subtask lineage: the depth gate, the ancestry/descendant queries, the
 * cascade participant set one run request opens, the deferred settlement of a
 * cascade parent, and the execution-target inheritance a subtask resolves at
 * run time.
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
 * The tasks one run request opens executions for: the requested task first,
 * then its on-board descendants within the configured depth. Archived tasks
 * never run; a participant that already has an open execution is skipped by
 * the caller, which cannot start it twice.
 */
export declare function cascadeTargets(tasks: readonly TaskRecord[], rootId: string, maxSubtaskDepth: number): TaskRecord[];
/** One still-open execution belonging to a cascade run group. */
export interface OpenCascadeChild {
    taskId: string;
    execution: ExecutionRecord;
}
/** The open execution of a task inside a run group, if it still exists. */
export declare function openGroupExecution(task: TaskRecord, runGroupId: string): ExecutionRecord | undefined;
/**
 * The direct subtasks of parentTaskId whose execution in this run group is
 * still open: the parent remaining waiters. The parent may settle once this
 * list is empty and its own outcome is known.
 */
export declare function pendingCascadeChildren(tasks: readonly TaskRecord[], parentTaskId: string, runGroupId: string): OpenCascadeChild[];
/**
 * Fold a cascade parent own outcome and its children outcomes into one
 * verdict: failure dominates, then cancellation, then success. The error text
 * is the first failure, falling back to the first cancellation.
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
 * Workspace, agent preset and model inherit the ancestor's PIN only — a
 * handover bundle is a per-card continuation artefact and is never inherited.
 * The permission inherits the ancestor's EFFECTIVE binding, and its human
 * confirmation travels with it, so a subtask of an already-confirmed elevated
 * card is runnable while a subtask's own unconfirmed binding stays gated.
 */
/**
 * The immutable teammate name for one team-mode member. Teammate names are
 * lower-kebab-case and must stay unique for the lifetime of the Team: the
 * run-group token separates two runs of the same tree, and the member
 * discriminator separates two members of one run that reduce to the same slug.
 *
 * The discriminator is not cosmetic. A title with no ASCII word characters (a
 * CJK title, for example) carries no slug at all, so every such title of one
 * run group collides on the generic prefix; Agent Teams answers every member
 * after the first with `teammate name "..." was already used in this Team`,
 * and those subtasks never start. Two ASCII titles that share a slug
 * (`AI 强度预测` next to `AI 配比优化`) collide the same way.
 * @param title - the member task's title.
 * @param token - the run group id (the task id when no group is recorded).
 * @param memberId - the member task's id, which makes the name unique in the run.
 * @returns the teammate name handed to the Agent Teams service.
 */
export declare function teammateName(title: string, token: string, memberId?: string): string;
export declare function resolveExecutionTargets(task: TaskRecord, tasks: readonly TaskRecord[], maxSubtaskDepth?: number): TaskRecord;
