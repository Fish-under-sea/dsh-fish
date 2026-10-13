import type { TaskUpdatePatch } from './core/use-cases/task-update.ts'
import type { SetSchedulePatch } from './core/use-cases/task-schedule.ts'
import { SCHEDULE_STOP_REASONS, TAG_NAME_MAX_LENGTH, isTaskPermission, isTaskStatus, isTaskTagList, type NewTaskInput, type ScheduleStopReason, type TaskPermission, type TaskRecord, type TaskStatus } from './core/tasks.ts'
import { parseLedger } from './core/store.ts'
import { isValidTimeZone } from './core/schedule.ts'
import { sanitizeFreezeSnapshot, type FreezeSnapshot } from './core/freeze-snapshot.ts'
import { sanitizeHandover, type TaskHandoverInput } from './core/handover.ts'
import { isTaskBoardExtensionPayload, normalizeTaskIntegrations, type TaskBoardExtensionPayload } from './core/extension.ts'
import { normalizeVerification, type ModelCatalogView, type VerificationContract, type VerificationSettings } from './core/verification.ts'

/** Freeze payload carried by create/update actions after the gate (redacted in place). */
type FreezePayload = FreezeSnapshot & { redacted?: boolean; frozenBy?: string }

export const TASK_BOARD_SCHEMA_VERSION = 6 as const
/** Ledger documents written before v6; loaded once and migrated on startup. */
export const TASK_BOARD_LEGACY_SCHEMA_VERSION = 5 as const
/** Ledger documents written before v5; migrated through the v5 normalization too. */
export const TASK_BOARD_PRE_ACCEPTANCE_SCHEMA_VERSION = 4 as const
/** Ledger documents written before v4; migrated through the v4 normalization too. */
export const TASK_BOARD_OLDER_SCHEMA_VERSION = 3 as const
/** Ledger documents written before v3; migrated through every later normalization too. */
export const TASK_BOARD_OLDEST_SCHEMA_VERSION = 2 as const
/**
 * The last generation whose rules still need the Host zone stamped on them at
 * migration: v4 introduced the stored zone but a rule written without one must
 * stop following a later TZ change. A v5 rule already carries its zone (or
 * deliberately follows the Host), so it is NOT stamped again.
 */
export const TASK_BOARD_ZONE_STAMP_SCHEMA_VERSION = 4 as const
/**
 * Every older generation the loader migrates in place. v5 only added the
 * per-execution acceptance block and v6 only added the scheduling mode and run
 * budget, so the migration is the normalization pass that re-validates each
 * row; a document from any listed generation upgrades losslessly.
 */
export const TASK_BOARD_MIGRATABLE_SCHEMA_VERSIONS: readonly number[] = [
  TASK_BOARD_LEGACY_SCHEMA_VERSION,
  TASK_BOARD_PRE_ACCEPTANCE_SCHEMA_VERSION,
  TASK_BOARD_OLDER_SCHEMA_VERSION,
  TASK_BOARD_OLDEST_SCHEMA_VERSION,
]
export const TASK_BOARD_API_PREFIX = '/api/task-board'

/** Longest accepted caller identity on an external outcome record. */
export const EXTERNAL_INITIATOR_MAX_LENGTH = 200

/** Longest accepted free-text summary on an external outcome record. */
export const EXTERNAL_SUMMARY_MAX_LENGTH = 1_000

export type PowerPhase = 'disabled' | 'idle' | 'acquiring' | 'active' | 'error' | 'unsupported'

export interface TaskBoardPowerSnapshot {
  platform: string
  phase: PowerPhase
  enabled: boolean
  runningSessions: number
  armedSchedules: number
  sessionStateKnown: boolean
  lastError?: string
}

export interface TaskBoardSchedulerSnapshot {
  timeZone: string
  /** Opaque identity of the current Host ledger generation. */
  ledgerId?: string
  lastTickAt?: number
  error?: string
}

export interface TaskBoardSnapshot {
  schemaVersion: typeof TASK_BOARD_SCHEMA_VERSION
  revision: number
  tasks: TaskRecord[]
  scheduler: TaskBoardSchedulerSnapshot
  power: TaskBoardPowerSnapshot
  /** Session-default permission the confirmation gate compares against. */
  sessionDefaultPermission?: TaskPermission
  /**
   * Deployment subtask depth limit (1..3). The browser mirrors it to enable or
   * disable the subtask controls; the Host ledger is the authority.
   */
  maxSubtaskDepth?: number
  /**
   * Whether this deployment serves the Agent Teams service, so a task may opt
   * into team execution (Team Lead session plus one teammate per subtask).
   */
  teamRunAvailable?: boolean
  /**
   * Live GLOBAL native-/goal switch. The browser uses it to disable the
   * task-level option (and explain that the global switch must be turned on
   * first) WITHOUT rewriting anyone's stored per-task preference; the Host
   * freezes its own read per execution, so this mirror never governs a run in
   * flight.
   */
  goalRunEnabled?: boolean
  /**
   * Read-only summaries published by running extensions, keyed by extension id.
   * The board forwards them verbatim; it never interprets their shape.
   */
  extensions?: Record<string, unknown>
}

/**
 * Body of `GET {TASK_BOARD_API_PREFIX}/verification`: the acceptance settings the
 * card edits, the contract they resolve to right now, and the host model catalog
 * the model and reasoning choices come from. Served through the same loopback /
 * authenticated-proxy guard as the rest of the board API, and it carries no
 * credential material — model routes and level ids only.
 */
export interface TaskBoardVerificationOptions {
  settings: VerificationSettings
  /** The RESOLVED contract, so the card can show what the next execution freezes. */
  contract: VerificationContract
  catalog: ModelCatalogView
}

/** SSE event frame: revision/scheduler/power only, never the task list. */
export interface TaskBoardEventPayload {
  revision: number
  scheduler: TaskBoardSchedulerSnapshot
  power: TaskBoardPowerSnapshot
}

/**
 * Request body of `POST {TASK_BOARD_API_PREFIX}/parse` (issue #1540): the text
 * the user pasted plus the `provider/model` route that should parse it.
 */
export interface TaskBoardParseRequest {
  text: string
  /** Qualified route from the model picker; absent when no route was chosen. */
  model?: string
}

/** Draft fields a parse returns; the user reviews them before creating the task. */
export interface TaskBoardParseDraft {
  title: string
  description: string
  prompt: string
}

/** Strict parse of a `/parse` request body; undefined rejects the request. */
export function parseTaskParseRequest(value: unknown): TaskBoardParseRequest | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const record = value as { text?: unknown; model?: unknown }
  if (typeof record.text !== 'string' || record.text.trim() === '') return undefined
  if (record.model !== undefined && typeof record.model !== 'string') return undefined
  const model = typeof record.model === 'string' ? record.model.trim() : ''
  return { text: record.text, ...(model === '' ? {} : { model }) }
}

/** Whether a decoded reply carries the three draft strings the form accepts. */
export function isTaskParseDraft(value: unknown): value is TaskBoardParseDraft {
  if (typeof value !== 'object' || value === null) return false
  const record = value as { title?: unknown; description?: unknown; prompt?: unknown }
  return typeof record.title === 'string' && typeof record.description === 'string' && typeof record.prompt === 'string'
}

export type TaskBoardAction =
  | { kind: 'import'; sourceId: string; tasks: TaskRecord[] }
  | { kind: 'create'; id: string; input: NewTaskInput }
  | { kind: 'update'; taskId: string; patch: TaskUpdatePatch }
  | { kind: 'delete'; taskId: string }
  | { kind: 'move'; taskId: string; status: TaskStatus }
  | { kind: 'archive'; taskId: string }
  | { kind: 'restore'; taskId: string }
  | { kind: 'settle'; taskId: string }
  /** Clear the acceptance anomalies recorded on a card's open execution (issue #1828). */
  | { kind: 'reset-verification'; taskId: string }
  /**
   * Record an outcome an agent OUTSIDE the Host produced (issue #1826).
   *
   * It writes a real execution record, so the terminal column and the run
   * history both derive from that one record instead of a bare column edit.
   * `cancelled` is deliberately absent: nothing outside a DSH session may
   * claim the Host closed a run, and `running` must stay Host-only.
   */
  | { kind: 'record-external-outcome'; taskId: string; result: 'succeeded' | 'failed'; initiatedBy: string; summary?: string }
  | { kind: 'set-schedule'; taskId: string; patch: SetSchedulePatch }
  | { kind: 'run'; taskId: string }
  | { kind: 'rerun'; taskId: string }
  | { kind: 'confirm-permission'; taskId: string }
  | { kind: 'set-parent'; taskId: string; parentId: string | null }
  /** Ledger-wide label management; see core/use-cases/task-tag.ts. */
  | { kind: 'rename-tag'; from: string; to: string }
  | { kind: 'delete-tag'; name: string }
  | { kind: 'extension-action'; extensionId: string; action: string; taskId?: string; payload?: TaskBoardExtensionPayload }

export interface TaskBoardActionEnvelope {
  requestId: string
  action: TaskBoardAction
  /**
   * Session id of the DSH session issuing the action, for the execution audit
   * trail (issue #6). Client-asserted, not a trust boundary; parsed only as a
   * bounded non-empty string and recorded on opened executions / freeze stamps.
   */
  initiator?: string
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every(key => allowed.includes(key))
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

const FORBIDDEN_IMPORT_FIELDS = new Set(['args', 'command', 'executable', 'powershell', 'shell'])

function hasForbiddenImportField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenImportField)
  const row = record(value)
  if (row === undefined) return false
  return Object.entries(row).some(([key, nested]) => FORBIDDEN_IMPORT_FIELDS.has(key.toLowerCase()) || hasForbiddenImportField(nested))
}

function optionalFiniteNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value))
}

/** Whether a stop-reason field names a reason this build understands. */
function validStopReason(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' && SCHEDULE_STOP_REASONS.includes(value as ScheduleStopReason))
}

/**
 * Whether an imported schedule rule is structurally usable. A one-shot must
 * carry its planned instant and a recurring rule its cron expression; the
 * counter and stop record are optional (a rule written before them simply has
 * none), but a value that IS present must be usable so the import cannot smuggle
 * a rule the scheduler would misread.
 */
function validImportedSchedule(value: unknown): boolean {
  const schedule = record(value)
  if (schedule === undefined || typeof schedule.enabled !== 'boolean') return false
  if (schedule.mode !== undefined && schedule.mode !== 'cron' && schedule.mode !== 'once') return false
  if (schedule.mode === 'once') {
    if (typeof schedule.at !== 'number' || !Number.isFinite(schedule.at)) return false
  } else if (typeof schedule.cron !== 'string') {
    return false
  }
  if (schedule.cron !== undefined && typeof schedule.cron !== 'string') return false
  if (schedule.at !== undefined && (typeof schedule.at !== 'number' || !Number.isFinite(schedule.at))) return false
  if (schedule.maxRuns !== undefined
    && (typeof schedule.maxRuns !== 'number' || !Number.isInteger(schedule.maxRuns) || schedule.maxRuns < 1)) return false
  if (schedule.runCount !== undefined
    && (typeof schedule.runCount !== 'number' || !Number.isInteger(schedule.runCount) || schedule.runCount < 0)) return false
  if (!optionalFiniteNumber(schedule.nextRunAt) || !optionalFiniteNumber(schedule.lastTriggeredAt)) return false
  if (!optionalFiniteNumber(schedule.endedAt) || !optionalFiniteNumber(schedule.skippedAt)) return false
  if (!validStopReason(schedule.endedReason) || !validStopReason(schedule.skippedReason)) return false
  if (schedule.timeZone !== undefined
    && (typeof schedule.timeZone !== 'string' || !isValidTimeZone(schedule.timeZone))) return false
  return true
}

function validImportedKnownFields(value: Record<string, unknown>): boolean {
  // Tags are validated (not repaired) on the import path: an imported task
  // must carry a well-formed list or none at all, so a hand-edited export
  // cannot smuggle a malformed tag past the gate.
  if (value.tags !== undefined && !isTaskTagList(value.tags)) return false
  if (value.integrations !== undefined && normalizeTaskIntegrations(value.integrations) === undefined) return false
  if (value.schedule !== undefined && !validImportedSchedule(value.schedule)) return false
  if (value.executions !== undefined) {
    if (!Array.isArray(value.executions)) return false
    for (const item of value.executions) {
      const execution = record(item)
      if (execution === undefined || typeof execution.id !== 'string' || !optionalString(execution.sessionId)) return false
      if (typeof execution.startedAt !== 'number' || !Number.isFinite(execution.startedAt)) return false
      if (!optionalFiniteNumber(execution.endedAt) || !optionalString(execution.error)) return false
      if (execution.result !== undefined && !['succeeded', 'failed', 'cancelled'].includes(String(execution.result))) return false
      if (execution.initiatedBy !== undefined && typeof execution.initiatedBy !== 'string') return false
      // An imported external marker is accepted (it is a declaration an
      // operator made about their own board), but it is still just a boolean:
      // the acceptance block below is what must never arrive from an import.
      if (execution.external !== undefined && typeof execution.external !== 'boolean') return false
      if (execution.frozenBy !== undefined && typeof execution.frozenBy !== 'string') return false
      if (execution.frozenAt !== undefined && typeof execution.frozenAt !== 'number') return false
      // A well-formed acceptance block may be imported for inspection, but the
      // import path DROPS it (see importedTask): a fabricated pass record must
      // never let an imported execution settle as verified.
      if (execution.verification !== undefined && normalizeVerification(execution.verification) === undefined) return false
    }
  }
  return true
}

function importedTask(value: unknown): TaskRecord | undefined {
  const input = record(value)
  if (input === undefined || hasForbiddenImportField(input) || !validImportedKnownFields(input)) return undefined
  const task = parseLedger(JSON.stringify([value]))[0]
  if (task === undefined) return undefined
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    prompt: task.prompt,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    executions: task.executions.map(execution => ({
      id: execution.id,
      sessionId: execution.sessionId,
      startedAt: execution.startedAt,
      endedAt: execution.endedAt,
      result: execution.result,
      error: execution.error,
      ...(execution.initiatedBy === undefined ? {} : { initiatedBy: execution.initiatedBy }),
      ...(execution.external === true ? { external: true } : {}),
      ...(execution.frozenAt === undefined ? {} : { frozenAt: execution.frozenAt }),
      ...(execution.frozenBy === undefined ? {} : { frozenBy: execution.frozenBy }),
      // 安全门（对抗场景 d）：验收报告是 Host 的判定，不接受 import 携带——
      // 一条伪造的通过记录会让导入的执行被当成已验收。
    })),
    // The rule was already reconstructed field by field by parseLedger (which
    // is what drops an unknown or malformed field), so the import keeps that
    // normalized shape: mode, planned instant, run counter and stop record all
    // travel with it.
    ...(task.schedule === undefined ? {} : { schedule: { ...task.schedule } }),
    // The lineage link rides the import; the Host repairs a link whose parent
    // is missing from the merged ledger instead of trusting the export.
    ...(task.parentId === undefined ? {} : { parentId: task.parentId }),
    ...(task.workspaceId === undefined ? {} : { workspaceId: task.workspaceId }),
    ...(task.mode === undefined ? {} : { mode: task.mode }),
    ...(task.permission === undefined ? {} : { permission: task.permission }),
    ...(task.reuseSession === undefined ? {} : { reuseSession: task.reuseSession }),
    ...(task.goalRun === undefined ? {} : { goalRun: task.goalRun }),
    // The per-card acceptance opt-out rides the import like the /goal opt-in:
    // it is a user-chosen execution preference on their own board, not a
    // verdict. The per-execution `verification` block is still stripped below, so
    // no imported card can arrive already accepted.
    ...(task.skipVerification === undefined ? {} : { skipVerification: task.skipVerification }),
    ...(task.archivedAt === undefined ? {} : { archivedAt: task.archivedAt }),
    ...(task.freeze === undefined ? {} : { freeze: task.freeze }),
    ...(task.handover === undefined ? {} : { handover: task.handover }),
    ...(task.tags === undefined ? {} : { tags: task.tags }),
    ...(task.integrations === undefined ? {} : { integrations: task.integrations }),
    // 安全门（对抗场景 b）：import 不是人工确认动作，确认戳一律剥除——
    // 高于会话默认权限的绑定经 import 进入后必须重新武装 confirm-permission 门。
  }
}

/**
 * Gate a freeze payload from the wire: same T2 security gates as the parser
 * (slash-command taint rejects, sensitive patterns redact in place, 8 KiB
 * per-field cap). Returns the sanitized payload, or undefined when rejected.
 */
function freezePayload(value: unknown): FreezePayload | undefined {
  const result = sanitizeFreezeSnapshot(value, ['redacted', 'frozenBy'])
  if (!result.ok) return undefined
  const frozenBy = result.extras.frozenBy
  if (frozenBy !== undefined && (typeof frozenBy !== 'string' || frozenBy === '')) return undefined
  return {
    ...result.snapshot,
    ...(result.redacted || result.extras.redacted === true ? { redacted: true } : {}),
    ...(frozenBy === undefined ? {} : { frozenBy }),
  }
}

/**
 * Gate a handover bundle from the wire: exact keys, bounded string targets,
 * a known permission, and a bounded references list. Returns the sanitized
 * bundle, or undefined when rejected.
 */
function handoverPayload(value: unknown): TaskHandoverInput | undefined {
  return sanitizeHandover(value)
}

function createInput(value: unknown): value is NewTaskInput {
  const input = record(value)
  if (input === undefined || !exactKeys(input, ['title', 'description', 'prompt', 'parentId', 'workspaceId', 'mode', 'permission', 'schedule', 'freeze', 'handover', 'model', 'reuseSession', 'teamRun', 'goalRun', 'skipVerification', 'tags', 'integrations'])) return false
  if (input.parentId !== undefined && (typeof input.parentId !== 'string' || input.parentId.trim() === '')) return false
  if (typeof input.title !== 'string' || typeof input.description !== 'string' || typeof input.prompt !== 'string') return false
  if (!optionalString(input.workspaceId) || !optionalString(input.mode) || !optionalString(input.model)) return false
  if (input.reuseSession !== undefined && typeof input.reuseSession !== 'boolean') return false
  if (input.teamRun !== undefined && typeof input.teamRun !== 'boolean') return false
  if (input.goalRun !== undefined && typeof input.goalRun !== 'boolean') return false
  if (input.skipVerification !== undefined && typeof input.skipVerification !== 'boolean') return false
  if (input.permission !== undefined && !isTaskPermission(input.permission)) return false
  if (input.tags !== undefined && !isTaskTagList(input.tags)) return false
  if (input.integrations !== undefined && normalizeTaskIntegrations(input.integrations) === undefined) return false
  if (input.freeze !== undefined && freezePayload(input.freeze) === undefined) return false
  if (input.handover !== undefined && handoverPayload(input.handover) === undefined) return false
  if (input.schedule !== undefined) {
    const schedule = record(input.schedule)
    if (schedule === undefined || !exactKeys(schedule, ['enabled', 'mode', 'cron', 'at', 'timeZone', 'maxRuns'])) return false
    if (typeof schedule.enabled !== 'boolean') return false
    if (schedule.mode !== undefined && schedule.mode !== 'cron' && schedule.mode !== 'once') return false
    if (schedule.cron !== undefined && typeof schedule.cron !== 'string') return false
    if (schedule.at !== undefined && (typeof schedule.at !== 'number' || !Number.isInteger(schedule.at))) return false
    if (schedule.maxRuns !== undefined
      && (typeof schedule.maxRuns !== 'number' || !Number.isInteger(schedule.maxRuns) || schedule.maxRuns < 1)) return false
    if (schedule.timeZone !== undefined
      && (typeof schedule.timeZone !== 'string' || !isValidTimeZone(schedule.timeZone))) return false
  }
  return true
}

function updatePatch(value: unknown): boolean {
  const patch = record(value)
  if (patch === undefined || !exactKeys(patch, ['title', 'description', 'prompt', 'workspaceId', 'mode', 'permission', 'freeze', 'handover', 'model', 'reuseSession', 'teamRun', 'goalRun', 'skipVerification', 'tags'])) return false
  // null (or false) clears the reuse opt-in; only a real boolean is accepted.
  if (patch.reuseSession !== undefined && patch.reuseSession !== null && typeof patch.reuseSession !== 'boolean') return false
  if (patch.teamRun !== undefined && patch.teamRun !== null && typeof patch.teamRun !== 'boolean') return false
  // The goal opt-in is tri-state: null/true return the card to its default
  // (goal run), false pins a single plain turn.
  if (patch.goalRun !== undefined && patch.goalRun !== null && typeof patch.goalRun !== 'boolean') return false
  // The acceptance opt-out is the mirror tri-state: null/false return the card
  // to inheriting the board-wide switch, true pins it out of the gate.
  if (patch.skipVerification !== undefined && patch.skipVerification !== null && typeof patch.skipVerification !== 'boolean') return false
  for (const key of ['title', 'description', 'prompt', 'workspaceId', 'mode', 'model'] as const) {
    if (!optionalString(patch[key])) return false
  }
  if (patch.permission !== undefined && !isTaskPermission(patch.permission)) return false
  // null clears the label set; a present array must be a well-formed list.
  if (patch.tags !== undefined && patch.tags !== null && !isTaskTagList(patch.tags)) return false
  // null clears the snapshot; an object must pass the freeze gate.
  if (patch.freeze !== undefined && patch.freeze !== null && freezePayload(patch.freeze) === undefined) return false
  // Same convention for the handover bundle.
  return patch.handover === undefined || patch.handover === null || handoverPayload(patch.handover) !== undefined
}

/**
 * A label name on the wire: a non-empty trimmed string within the tag cap. The
 * trim/merge/duplicate rules belong to the use case; this gate only keeps a
 * malformed name off the ledger.
 */
function isTagName(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.trim().length <= TAG_NAME_MAX_LENGTH
}

function schedulePatch(value: unknown): boolean {
  const patch = record(value)
  return patch !== undefined
    && exactKeys(patch, ['enabled', 'mode', 'cron', 'at', 'timeZone', 'maxRuns'])
    && (patch.enabled === undefined || typeof patch.enabled === 'boolean')
    && (patch.mode === undefined || patch.mode === 'cron' || patch.mode === 'once')
    && (patch.cron === undefined || typeof patch.cron === 'string')
    // A one-shot's planned instant is a whole millisecond: a fractional or
    // non-numeric value would make the armed target ambiguous.
    && (patch.at === undefined || (typeof patch.at === 'number' && Number.isInteger(patch.at)))
    // `null` clears the stored zone back to the Host zone; an unknown name is
    // rejected here so the Host never has to guess at an unusable zone.
    && (patch.timeZone === undefined || patch.timeZone === null
      || (typeof patch.timeZone === 'string' && isValidTimeZone(patch.timeZone)))
    // `null` clears the run cap back to unlimited; any other value must be a
    // positive whole number of runs.
    && (patch.maxRuns === undefined || patch.maxRuns === null
      || (typeof patch.maxRuns === 'number' && Number.isInteger(patch.maxRuns) && patch.maxRuns >= 1))
}

export function parseActionEnvelope(value: unknown): TaskBoardActionEnvelope | undefined {
  const parsed = parseEnvelopeAction(value)
  if (parsed === undefined) return undefined
  // Attach the audit-only initiator stamp (already validated above) to every accepted action.
  const initiator = initiatorOf(value)
  return initiator === undefined ? parsed : { ...parsed, initiator }
}

function initiatorOf(value: unknown): string | undefined {
  const envelope = record(value)
  const id = envelope?.initiator
  return typeof id === 'string' && id.trim() !== '' && id.length <= 256 ? id : undefined
}

function parseEnvelopeAction(value: unknown): TaskBoardActionEnvelope | undefined {
  const envelope = record(value)
  if (envelope === undefined || !exactKeys(envelope, ['requestId', 'action', 'initiator'])) return undefined
  if (typeof envelope.requestId !== 'string' || envelope.requestId.trim() === '' || envelope.requestId.length > 256) return undefined
  if (envelope.initiator !== undefined && initiatorOf(value) === undefined) return undefined
  const action = record(envelope.action)
  if (action === undefined || typeof action.kind !== 'string') return undefined
  const taskId = typeof action.taskId === 'string' && action.taskId !== '' ? action.taskId : undefined
  switch (action.kind) {
    case 'import':
      if (!exactKeys(action, ['kind', 'sourceId', 'tasks'])) return undefined
      if (typeof action.sourceId !== 'string' || action.sourceId === '' || !Array.isArray(action.tasks)) return undefined
      {
        const tasks = action.tasks.map(importedTask)
        return tasks.every((task): task is TaskRecord => task !== undefined)
          ? { requestId: envelope.requestId, action: { kind: 'import', sourceId: action.sourceId, tasks } }
          : undefined
      }
    case 'create': {
      if (!exactKeys(action, ['kind', 'id', 'input'])) return undefined
      if (typeof action.id !== 'string' || action.id === '' || !createInput(action.input)) return undefined
      const input = action.input as NewTaskInput
      const freeze = input.freeze === undefined ? undefined : freezePayload(input.freeze)
      const handover = input.handover === undefined ? undefined : handoverPayload(input.handover)
      const sanitized = freeze === undefined && handover === undefined ? input : { ...input, ...(freeze === undefined ? {} : { freeze }), ...(handover === undefined ? {} : { handover }) }
      return { requestId: envelope.requestId, action: { kind: 'create', id: action.id as string, input: sanitized } }
    }
    case 'update': {
      if (!exactKeys(action, ['kind', 'taskId', 'patch'])) return undefined
      if (taskId === undefined || !updatePatch(action.patch)) return undefined
      const patch = action.patch as TaskUpdatePatch
      const freeze = patch.freeze === undefined || patch.freeze === null ? patch.freeze : freezePayload(patch.freeze)
      const handover = patch.handover === undefined || patch.handover === null ? patch.handover : handoverPayload(patch.handover)
      const sanitized = ('freeze' in patch && freeze !== patch.freeze) || ('handover' in patch && handover !== patch.handover)
        ? { ...patch, ...(freeze === patch.freeze ? {} : { freeze }), ...(handover === patch.handover ? {} : { handover }) }
        : patch
      return { requestId: envelope.requestId, action: { kind: 'update', taskId, patch: sanitized } }
    }
    case 'set-parent': {
      if (!exactKeys(action, ['kind', 'taskId', 'parentId'])) return undefined
      if (taskId === undefined) return undefined
      const parentId = action.parentId
      if (parentId !== null && (typeof parentId !== 'string' || parentId.trim() === '')) return undefined
      return { requestId: envelope.requestId, action: { kind: 'set-parent', taskId, parentId } }
    }
    case 'rename-tag': {
      if (!exactKeys(action, ['kind', 'from', 'to'])) return undefined
      if (!isTagName(action.from) || !isTagName(action.to)) return undefined
      return { requestId: envelope.requestId, action: { kind: 'rename-tag', from: action.from, to: action.to } }
    }
    case 'delete-tag': {
      if (!exactKeys(action, ['kind', 'name'])) return undefined
      if (!isTagName(action.name)) return undefined
      return { requestId: envelope.requestId, action: { kind: 'delete-tag', name: action.name } }
    }
    case 'set-schedule':
      if (!exactKeys(action, ['kind', 'taskId', 'patch'])) return undefined
      return taskId !== undefined && schedulePatch(action.patch)
        ? { requestId: envelope.requestId, action: action as unknown as Extract<TaskBoardAction, { kind: 'set-schedule' }> }
        : undefined
    case 'move':
      if (!exactKeys(action, ['kind', 'taskId', 'status'])) return undefined
      return taskId !== undefined && isTaskStatus(action.status)
        ? { requestId: envelope.requestId, action: action as unknown as Extract<TaskBoardAction, { kind: 'move' }> }
        : undefined
    case 'extension-action': {
      // Structural gate only: whether the id names a registered, enabled
      // extension is decided by the host registry, which owns that state.
      if (!exactKeys(action, ['kind', 'extensionId', 'action', 'taskId', 'payload'])) return undefined
      if (typeof action.extensionId !== 'string' || action.extensionId.trim() === '' || action.extensionId.length > 128) return undefined
      if (typeof action.action !== 'string' || action.action.trim() === '' || action.action.length > 128) return undefined
      if (action.taskId !== undefined && (typeof action.taskId !== 'string' || action.taskId === '')) return undefined
      if (action.payload !== undefined && !isTaskBoardExtensionPayload(action.payload)) return undefined
      return {
        requestId: envelope.requestId,
        action: {
          kind: 'extension-action',
          extensionId: action.extensionId,
          action: action.action,
          ...(action.taskId === undefined ? {} : { taskId: action.taskId }),
          ...(action.payload === undefined ? {} : { payload: action.payload }),
        },
      }
    }
    case 'record-external-outcome': {
      if (!exactKeys(action, ['kind', 'taskId', 'result', 'initiatedBy', 'summary'])) return undefined
      if (taskId === undefined) return undefined
      // Only a real outside verdict is accepted: `running` is Host-only and
      // `cancelled` is the Host's own bookkeeping for a run it closed.
      if (action.result !== 'succeeded' && action.result !== 'failed') return undefined
      if (typeof action.initiatedBy !== 'string') return undefined
      const initiatedBy = action.initiatedBy.trim()
      // The caller must be identifiable: an unattributed external outcome is
      // the same 'state without history' the record exists to avoid.
      if (initiatedBy === '' || initiatedBy.length > EXTERNAL_INITIATOR_MAX_LENGTH) return undefined
      if (action.summary !== undefined && typeof action.summary !== 'string') return undefined
      const summary = typeof action.summary === 'string' ? action.summary.trim().slice(0, EXTERNAL_SUMMARY_MAX_LENGTH) : ''
      return {
        requestId: envelope.requestId,
        action: {
          kind: 'record-external-outcome',
          taskId,
          result: action.result,
          initiatedBy,
          ...(summary === '' ? {} : { summary }),
        },
      }
    }
    case 'confirm-permission':
    case 'delete':
    case 'archive':
    case 'restore':
    case 'settle':
    case 'reset-verification':
    case 'run':
    case 'rerun':
      if (!exactKeys(action, ['kind', 'taskId'])) return undefined
      return taskId === undefined ? undefined : { requestId: envelope.requestId, action: action as TaskBoardAction }
    default:
      return undefined
  }
}
