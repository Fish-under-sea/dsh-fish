/**
 * Schedule use cases: arm/disarm a task's scheduling rule, and record what a
 * due occurrence did to it. Pure ledger transitions (no persistence or notify
 * — the controller orchestrates those). Validation and next-run computation
 * live here, sharing the core cron parser (schedule.ts) and the withSchedule
 * transition.
 *
 * A rule is either a recurring cron rule or a single planned instant, and
 * either kind may be capped by a run budget. The counter (`runCount`) moves
 * only when the Host actually opened an execution; a skipped occurrence
 * (busy, unconfirmed permission, missed instant, unreachable plan) moves the
 * rule without consuming its budget.
 */
import { isValidCron, isValidTimeZone, nextRunAtMs } from '../schedule.ts'
import { withSchedule, type ScheduleMode, type ScheduleRule, type ScheduleStopReason, type TaskRecord } from '../tasks.ts'

/** Fields the schedule use case may change on a rule. */
export interface SetSchedulePatch {
  enabled?: boolean
  /** Which kind of plan to write; an absent key keeps the current mode. */
  mode?: ScheduleMode
  /** 5-field cron expression of a recurring rule. */
  cron?: string
  /** Planned instant of a one-shot rule (ms epoch). */
  at?: number
  /** IANA zone for the wall clock; `null` clears it back to the Host zone. */
  timeZone?: string | null
  /** Run cap of a recurring rule; `null` clears it back to unlimited. */
  maxRuns?: number | null
}

/** Result of arming/disarming a rule. */
export interface SetScheduleResult {
  /** The next ledger; unchanged reference when rejected. */
  tasks: readonly TaskRecord[]
  /** Whether the rule was applied (false on unknown task / invalid plan). */
  applied: boolean
}

/**
 * Set an on-board task's scheduling rule. An unknown or archived task, an
 * unusable zone, a blank or invalid cron, a one-shot with no usable instant,
 * a one-shot armed in the past, and a run cap that is not a positive integer
 * are all rejected (state untouched). An enabled rule computes its next run
 * instant immediately — a one-shot's next instant IS its planned instant — and
 * a disabled rule carries none.
 *
 * Arming a rule that was not enabled, or switching its kind, starts a fresh
 * budget: the run counter and any previous stop/skip record are cleared. Edits
 * to a live rule (expression, zone, cap) keep the consumed count, so an
 * already-spent budget can never silently reset and overrun.
 * @param tasks - current ledger.
 * @param id - the task to schedule.
 * @param patch - rule fields to change (absent fields keep their current value).
 * @param now - clock instant (ms epoch).
 * @param hostTimeZone - zone a rule with no stored zone follows.
 */
export function applySetSchedule(
  tasks: readonly TaskRecord[],
  id: string,
  patch: SetSchedulePatch,
  now: number,
  hostTimeZone: string,
): SetScheduleResult {
  const task = tasks.find(candidate => candidate.id === id)
  if (task === undefined || task.archivedAt !== undefined) return { tasks, applied: false }
  const current = task.schedule
  const mode: ScheduleMode = patch.mode ?? current?.mode ?? 'cron'
  // An explicit null clears the stored zone; an absent key keeps it.
  const timeZone = patch.timeZone === undefined ? current?.timeZone : patch.timeZone ?? undefined
  if (timeZone !== undefined && !isValidTimeZone(timeZone)) return { tasks, applied: false }
  const enabled = patch.enabled ?? current?.enabled ?? false
  const restart = (enabled && current?.enabled !== true) || (current?.mode ?? 'cron') !== mode
  const runCount = restart ? 0 : current?.runCount ?? 0
  const effectiveZone = timeZone ?? hostTimeZone
  const cleared = restart
    ? { endedAt: undefined, endedReason: undefined, skippedAt: undefined, skippedReason: undefined }
    : { endedAt: current?.endedAt, endedReason: current?.endedReason, skippedAt: current?.skippedAt, skippedReason: current?.skippedReason }

  if (mode === 'once') {
    const at = patch.at ?? current?.at
    if (at === undefined || !Number.isInteger(at)) return { tasks, applied: false }
    // A one-shot is armed for a FUTURE instant: re-arming one at or before
    // "now" would fire on the next tick, which is not what the user chose. A
    // disabled rule may keep a stored past instant as the record of its plan.
    if (enabled && at <= now) return { tasks, applied: false }
    return {
      tasks: tasks.map(candidate => candidate.id !== id ? candidate : withSchedule(candidate, {
        enabled,
        mode: 'once',
        at,
        cron: undefined,
        maxRuns: undefined,
        timeZone: timeZone ?? undefined,
        nextRunAt: enabled ? at : undefined,
        runCount,
        ...cleared,
      }, now)),
      applied: true,
    }
  }

  const cron = (patch.cron ?? current?.cron ?? '').trim()
  if (cron === '' || !isValidCron(cron)) return { tasks, applied: false }
  // An absent key keeps the stored cap; an explicit null clears it (unlimited).
  const maxRuns = ('maxRuns' in patch ? patch.maxRuns : current?.maxRuns) ?? undefined
  if (maxRuns !== undefined && (!Number.isInteger(maxRuns) || maxRuns < 1)) return { tasks, applied: false }
  const spent = maxRuns !== undefined && runCount >= maxRuns
  const armed = enabled && !spent
  const nextRunAt = armed ? nextRunAtMs(cron, now, effectiveZone) : undefined
  if (armed && nextRunAt === undefined) return { tasks, applied: false }
  // Lowering the cap below what the rule already ran ends it immediately
  // instead of leaving an exhausted rule that would wait for a fire to die.
  const exhausted = enabled && spent
  return {
    tasks: tasks.map(candidate => candidate.id !== id ? candidate : withSchedule(candidate, {
      enabled: armed,
      mode: 'cron',
      cron,
      at: undefined,
      maxRuns,
      timeZone: timeZone ?? undefined,
      nextRunAt,
      runCount,
      ...(exhausted ? { endedAt: now, endedReason: 'limit' as const } : cleared),
    }, now)),
    applied: true,
  }
}

/**
 * Roll a task's schedule rule forward (legacy pure-controller seam): persist
 * the next due instant and the trigger instant. No-op for tasks without a rule.
 * @param tasks - current ledger.
 * @param id - the task to roll forward.
 * @param nextRunAt - next due instant (may be undefined to clear).
 * @param lastTriggeredAt - the trigger instant of this run.
 * @param now - clock instant (ms epoch).
 */
export function applyScheduleNextRun(
  tasks: readonly TaskRecord[],
  id: string,
  nextRunAt: number | undefined,
  lastTriggeredAt: number | undefined,
  now: number,
): readonly TaskRecord[] {
  return tasks.map(task =>
    task.id === id && task.archivedAt === undefined && task.schedule !== undefined
      ? withSchedule(task, { nextRunAt, lastTriggeredAt }, now)
      : task)
}

/**
 * The effect one due occurrence has on its rule, applied by the Host ledger.
 */
export interface ScheduleProgress {
  /** Executions this occurrence actually opened (0 or 1), added to the counter. */
  consumed: number
  /** Next due instant; absent stops the rule. */
  nextRunAt?: number
  /** Trigger instant recorded as `lastTriggeredAt` (a consumed run only). */
  lastTriggeredAt?: number
  /** Terminal reason when the rule stops itself (disarms it). */
  endedReason?: ScheduleStopReason
  /** Why this occurrence produced no run, when it did not. */
  skippedReason?: ScheduleStopReason
}

/**
 * Refund the one scheduled run an occurrence consumed before its launch failed
 * without ever creating a session. Nothing ran, so the run budget is restored
 * and the rule is left able to serve its next occurrence — a launch failure
 * must never silently spend the user's limited budget.
 *
 * A recurring rule keeps its already-rolled-forward target; a fire that ended
 * the rule at its cap (no target left) is restored and re-armed at the next
 * occurrence, so a failed launch consumes nothing. A one-shot has no later
 * occurrence, so it is left stopped with `launch-failed` and its run returned.
 * A rule the user disabled in the meantime is not resurrected.
 * @param tasks - current ledger.
 * @param id - the task whose occurrence is being refunded.
 * @param now - clock instant (ms epoch).
 * @param hostTimeZone - zone a rule with no stored zone follows.
 * @returns the next ledger.
 */
export function applyScheduleRefund(
  tasks: readonly TaskRecord[],
  id: string,
  now: number,
  hostTimeZone: string,
): readonly TaskRecord[] {
  return tasks.map(task => {
    if (task.id !== id || task.archivedAt !== undefined || task.schedule === undefined) return task
    const rule = task.schedule
    const runCount = Math.max(rule.runCount - 1, 0)
    if (rule.mode === 'once') {
      return withSchedule(task, {
        enabled: false,
        runCount,
        nextRunAt: undefined,
        endedAt: now,
        endedReason: 'launch-failed',
        skippedAt: undefined,
        skippedReason: undefined,
      }, now)
    }
    const refunded = withSchedule(task, {
      runCount,
      skippedAt: now,
      skippedReason: 'launch-failed',
    }, now)
    // The fire already rolled the target forward; only a fire that spent its
    // last run (target cleared, ended at the cap) needs to be restored.
    if (rule.nextRunAt !== undefined || rule.endedReason !== 'limit') return refunded
    const cron = rule.cron ?? ''
    const next = cron === '' ? undefined : nextRunAtMs(cron, now, rule.timeZone ?? hostTimeZone)
    return withSchedule(refunded, next === undefined
      ? { enabled: false, endedAt: now, endedReason: 'no-target' }
      : { enabled: true, nextRunAt: next, endedAt: undefined, endedReason: undefined }, now)
  })
}

/**
 * Record what a due occurrence did to a task's rule: advance the run counter
 * by the executions it opened, set the next target (or stop the rule), and
 * note a terminal reason or a skipped occurrence. Nothing is written for a
 * task that has no rule or has been archived mid-tick.
 * @param tasks - current ledger.
 * @param id - the task whose rule fired.
 * @param progress - the occurrence's effect.
 * @param now - clock instant (ms epoch).
 * @returns the next ledger.
 */
export function applyScheduleProgress(
  tasks: readonly TaskRecord[],
  id: string,
  progress: ScheduleProgress,
  now: number,
): readonly TaskRecord[] {
  return tasks.map(task => {
    if (task.id !== id || task.archivedAt !== undefined || task.schedule === undefined) return task
    const patch: Partial<ScheduleRule> = {
      runCount: task.schedule.runCount + progress.consumed,
      nextRunAt: progress.nextRunAt,
      ...(progress.lastTriggeredAt === undefined ? {} : { lastTriggeredAt: progress.lastTriggeredAt }),
      ...(progress.endedReason === undefined ? {} : { enabled: false, endedAt: now, endedReason: progress.endedReason }),
      ...(progress.skippedReason === undefined ? {} : { skippedAt: now, skippedReason: progress.skippedReason }),
    }
    return withSchedule(task, patch, now)
  })
}
