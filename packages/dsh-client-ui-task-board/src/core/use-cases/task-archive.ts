/**
 * Archive/restore task use case: move a task off the main board and back,
 * whatever its status but running. The task keeps its status, execution
 * history, and transcript references, while archiving disarms any schedule so
 * it cannot create more execution records until the user restores and
 * re-enables it.
 *
 * Subtask trees move as a unit: archiving takes the whole subtree (an on-board
 * subtask under an archived parent would be unreachable from its parent) and
 * refuses the whole group while any member is running. Restoring brings the
 * task, its ancestors and its subtree back together.
 */
import { DEFAULT_SUBTASK_DEPTH, ancestorChain, descendantTasks, normalizeSubtaskDepth } from '../subtask.ts'
import type { TaskRecord } from '../tasks.ts'
import { ARCHIVABLE_STATUSES } from '../tasks.ts'

/** Result of an archive transition. */
export interface ArchiveTaskResult {
  /** The next ledger. */
  tasks: readonly TaskRecord[]
  /** Whether the archive was applied (false = unknown task / not archivable). */
  archived: boolean
}

/** The archive/restore id set: the task, its subtree, and (for restore) its ancestors. */
function groupIds(tasks: readonly TaskRecord[], id: string, maxSubtaskDepth: number, withAncestors: boolean): Set<string> {
  const target = tasks.find(task => task.id === id)
  const ids = new Set<string>([id])
  for (const task of descendantTasks(tasks, id, normalizeSubtaskDepth(maxSubtaskDepth))) ids.add(task.id)
  if (withAncestors && target !== undefined) {
    for (const ancestor of ancestorChain(tasks, target)) ids.add(ancestor.id)
  }
  return ids
}

/**
 * Archive one task and its subtasks: only a running member keeps the group on
 * the board (its runner still owns its lifecycle until the execution settles);
 * any other status can be archived. Archiving disarms schedules; an
 * already-archived task is a no-op.
 */
export function applyArchiveTask(
  tasks: readonly TaskRecord[],
  id: string,
  now: number,
  maxSubtaskDepth: number = DEFAULT_SUBTASK_DEPTH,
): ArchiveTaskResult {
  const target = tasks.find(task => task.id === id)
  if (target === undefined || target.archivedAt !== undefined) return { tasks, archived: false }
  const ids = groupIds(tasks, id, maxSubtaskDepth, false)
  const declining = tasks.some(task => ids.has(task.id) && !(ARCHIVABLE_STATUSES as readonly string[]).includes(task.status))
  if (declining) return { tasks, archived: false }
  let applied = false
  const next = tasks.map(task => {
    if (!ids.has(task.id) || task.archivedAt !== undefined) return task
    applied = true
    const schedule = task.schedule === undefined
      ? undefined
      : { ...task.schedule, enabled: false, nextRunAt: undefined }
    return {
      ...task,
      ...(schedule === undefined ? {} : { schedule }),
      archivedAt: now,
      updatedAt: now,
    }
  })
  return { tasks: next, archived: applied }
}

/**
 * Restore one task back onto the main board, together with its ancestors (an
 * on-board subtask must not point at an archived parent) and its subtasks.
 */
export function applyRestoreTask(
  tasks: readonly TaskRecord[],
  id: string,
  now: number,
  maxSubtaskDepth: number = DEFAULT_SUBTASK_DEPTH,
): ArchiveTaskResult {
  const target = tasks.find(task => task.id === id)
  if (target === undefined || target.archivedAt === undefined) return { tasks, archived: false }
  const ids = groupIds(tasks, id, maxSubtaskDepth, true)
  let applied = false
  const next = tasks.map(task => {
    if (!ids.has(task.id) || task.archivedAt === undefined) return task
    applied = true
    const { archivedAt: _archived, ...rest } = task
    return { ...rest, updatedAt: now }
  })
  return { tasks: next, archived: applied }
}
