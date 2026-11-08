/**
 * Create-task use case: mint a new task from user input, rejecting a blank
 * title and any parent link the lineage gate refuses. Pure ledger transition
 * (no persistence or notify - the controller orchestrates those), so it is
 * unit-testable without any runtime face.
 */
import { isValidCron, isValidTimeZone, nextRunAtMs, resolveHostTimeZone } from '../schedule.ts'
import { DEFAULT_SUBTASK_DEPTH, normalizeSubtaskDepth, taskDepth } from '../subtask.ts'
import { resolveCardTargets, type CardDefaults } from '../card-defaults.ts'
import { createTask, isTaskPermission, withSchedule, type NewTaskInput, type TaskRecord } from '../tasks.ts'

/** Result of a create transition: the new task (when accepted) + the next ledger. */
export interface CreateTaskResult {
  /** The minted task, or undefined when the input was rejected. */
  task: TaskRecord | undefined
  /** The next ledger; identical reference when rejected. */
  tasks: readonly TaskRecord[]
  /** Why the input was rejected; absent when a task was minted. */
  error?: string
}

/**
 * Apply a create against the current ledger. Returns the new task and the
 * appended ledger, or the unchanged ledger when the title is blank or the
 * requested parent link is refused.
 *
 * The execution targets resolve through {@link resolveCardTargets}: what the
 * caller sent wins, then the parent's own pins, then - only when the caller
 * opted in with `applyCardDefaults` - the deployment's configured new-card
 * defaults. Without the flag the resolution sees no defaults at all, which is
 * exactly the inline parent inheritance this path has always applied. The
 * workspace is not part of that resolution: a subtask still takes the parent's
 * workspace, and the defaults never name one.
 * @param tasks - current ledger.
 * @param input - raw user input (title/description/prompt + optional schedule/parent).
 * @param now - clock instant (ms epoch).
 * @param id - minted task id.
 * @param maxSubtaskDepth - deployment subtask depth limit.
 * @param hostTimeZone - zone a rule that stores no zone of its own follows.
 * @param cardDefaults - the deployment's new-card defaults, read live at creation.
 */
export function applyCreateTask(
  tasks: readonly TaskRecord[],
  input: NewTaskInput,
  now: number,
  id: string,
  maxSubtaskDepth: number = DEFAULT_SUBTASK_DEPTH,
  hostTimeZone: string = resolveHostTimeZone(),
  cardDefaults?: CardDefaults,
): CreateTaskResult {
  if (input.title.trim() === '') return { task: undefined, tasks, error: 'title is required' }
  const limit = normalizeSubtaskDepth(maxSubtaskDepth)
  let parent: TaskRecord | undefined
  if (input.parentId !== undefined) {
    parent = tasks.find(task => task.id === input.parentId)
    if (parent === undefined) return { task: undefined, tasks, error: 'parent task not found' }
    if (parent.archivedAt !== undefined) return { task: undefined, tasks, error: 'parent task is archived' }
    if (taskDepth(tasks, parent.id) + 1 > limit) {
      return { task: undefined, tasks, error: `subtask depth limit (${limit}) exceeded` }
    }
  }
  // The execution targets resolve through the one shared rule: the caller's own
  // choice, then the parent's own pins (never its permission, see
  // core/card-defaults.ts), then the deployment's new-card defaults — and only
  // when the caller asked for them, so a create that never opts in stores
  // exactly what it sent, as it always has.
  const seed = resolveCardTargets(
    input.applyCardDefaults === true ? cardDefaults : undefined,
    parent === undefined ? undefined : { kind: 'parent', task: parent },
    { mode: input.mode, permission: input.permission, model: input.model, reasoningEffort: input.reasoningEffort },
  )
  const effective: NewTaskInput = {
    ...input,
    workspaceId: input.workspaceId ?? parent?.workspaceId,
    mode: seed.mode,
    permission: isTaskPermission(seed.permission) ? seed.permission : undefined,
    model: seed.model,
    reasoningEffort: seed.reasoningEffort,
  }
  let task = createTask(effective, now, id)
  // Arm the requested schedule (new-task dialog). The Host wire gate already
  // rejects a malformed enabled plan; this arm re-checks it so a direct caller
  // (a test or an embedder) cannot persist an unusable rule either.
  const requested = input.schedule
  if (requested?.enabled === true) {
    const requestedZone = requested.timeZone
    // An unusable zone is refused rather than silently reinterpreted as the
    // Host zone: the caller asked for a specific wall clock.
    if (requestedZone !== undefined && !isValidTimeZone(requestedZone)) {
      return { task: undefined, tasks, error: 'invalid schedule time zone' }
    }
    if (requested.mode === 'once') {
      const at = requested.at
      if (at === undefined || !Number.isInteger(at) || at <= now) {
        return { task: undefined, tasks, error: 'invalid schedule instant' }
      }
      task = withSchedule(task, {
        enabled: true,
        mode: 'once',
        at,
        timeZone: requestedZone,
        nextRunAt: at,
        runCount: 0,
      }, now)
    } else {
      const cron = (requested.cron ?? '').trim()
      if (cron !== '' && isValidCron(cron)) {
        const maxRuns = requested.maxRuns
        if (maxRuns !== undefined && (!Number.isInteger(maxRuns) || maxRuns < 1)) {
          return { task: undefined, tasks, error: 'invalid schedule run cap' }
        }
        const zone = requestedZone ?? hostTimeZone
        const nextRunAt = nextRunAtMs(cron, now, zone)
        if (nextRunAt !== undefined) {
          task = withSchedule(task, { enabled: true, mode: 'cron', cron, maxRuns, timeZone: requestedZone, nextRunAt, runCount: 0 }, now)
        }
      }
    }
  }
  return { task, tasks: [...tasks, task] }
}
