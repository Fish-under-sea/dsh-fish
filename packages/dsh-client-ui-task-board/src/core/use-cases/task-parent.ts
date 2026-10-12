/**
 * Parent-link use case: attach an existing on-board task under another as a
 * subtask, or detach it back to the root. The lineage gate is the same one
 * creation uses (unknown or archived parent, self, cycle, depth), so the two
 * ways into the tree cannot disagree. Pure ledger transition.
 */
import { DEFAULT_SUBTASK_DEPTH, checkParentLink, normalizeSubtaskDepth, type ParentLinkRejection } from '../subtask.ts'
import type { TaskRecord } from '../tasks.ts'

/** Result of a parent-link transition. */
export interface SetParentResult {
  /** The next ledger; the input reference when refused. */
  tasks: readonly TaskRecord[]
  /** Whether the link (or the detachment) was stored. */
  applied: boolean
  /** User-facing refusal reason; absent when applied. */
  error?: string
}

/** Host error text per refusal reason (the wire carries the same strings). */
const REJECTION_TEXT: Record<ParentLinkRejection, string> = {
  'unknown-task': 'task not found',
  'unknown-parent': 'parent task not found',
  'archived-parent': 'parent task is archived',
  'self-parent': 'a task cannot be its own parent',
  'cycle': 'a task cannot be attached under its own subtask',
  'depth-exceeded': 'subtask depth limit exceeded',
}

/**
 * Attach or detach one task. A null (or blank) parent detaches, which is always
 * allowed for a known on-board task; attaching validates the whole chain so a
 * cyclic or too-deep ledger can never be stored.
 * @param tasks - current ledger.
 * @param id - the task being moved.
 * @param parentId - the new parent, or null to detach.
 * @param now - clock instant (ms epoch).
 * @param maxSubtaskDepth - deployment subtask depth limit.
 */
export function applySetParent(
  tasks: readonly TaskRecord[],
  id: string,
  parentId: string | null,
  now: number,
  maxSubtaskDepth: number = DEFAULT_SUBTASK_DEPTH,
): SetParentResult {
  const task = tasks.find(candidate => candidate.id === id)
  if (task === undefined) return { tasks, applied: false, error: REJECTION_TEXT['unknown-task'] }
  if (task.archivedAt !== undefined) return { tasks, applied: false, error: 'archived task is read-only' }
  // A task with an open execution may be a participant of a running cascade.
  // Moving it would break that group's parent walk and leave the parent card
  // in the running column forever, so the link is frozen until it settles. The
  // lock is the open execution: a card parked in 'running' by hand links freely.
  if (task.executions.some(execution => execution.endedAt === undefined)) {
    return { tasks, applied: false, error: 'running task cannot be re-parented' }
  }
  const check = checkParentLink(tasks, id, parentId, normalizeSubtaskDepth(maxSubtaskDepth))
  if (!check.ok) return { tasks, applied: false, error: REJECTION_TEXT[check.reason ?? 'unknown-task'] }
  const nextParentId = parentId === null || parentId === '' ? undefined : parentId
  if (nextParentId === task.parentId) return { tasks: [...tasks], applied: true }
  return {
    tasks: tasks.map(candidate => candidate.id === id ? { ...candidate, parentId: nextParentId, updatedAt: now } : candidate),
    applied: true,
  }
}
