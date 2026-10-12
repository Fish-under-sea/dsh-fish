/**
 * Host-side extension registry: the one place that admits external providers,
 * negotiates the contract version, gates them on the board's own enable state,
 * fans board events out to them, and routes dispatched provider actions back.
 *
 * Failure policy (mirrors the board's plugin philosophy): a provider that
 * throws, mis-declares its version, or disables itself degrades only its own
 * surface. The board keeps serving; the registry records what it refused.
 *
 * @module dsh-task-board/host/extension-registry
 */
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { HostTaskLedger } from '../host-ledger.ts'
import type { TaskBoardAction, TaskBoardSnapshot } from '../protocol.ts'
import { canEditTaskContent } from '../core/use-cases/task-update.ts'
import {
  TASK_BOARD_API_VERSION,
  isTaskBoardExtensionPayload,
  taskBoardPayloadBytes,
  type TaskBoardCreateOptions,
  type TaskBoardEventFace,
  type TaskBoardExecutionSettledEvent,
  type TaskBoardExtension,
  type TaskBoardExtensionActionRequest,
  type TaskBoardExtensionHost,
  type TaskBoardExtensionPayload,
  type TaskBoardIntegrationFace,
  type TaskBoardLinkedTask,
  type TaskBoardStatusChangedEvent,
  type TaskBoardTaskDeletedEvent,
  type TaskBoardTasksFace,
} from '../core/extension.ts'
import { isTaskStatus, type TaskRecord, type TaskStatus } from '../core/tasks.ts'

/** Diagnosable refusal raised by the registry and the capability face. */
export class TaskBoardExtensionError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(`task-board extension [${code}]: ${message}`)
    this.name = 'TaskBoardExtensionError'
    this.code = code
  }
}

/** Logging seat the registry uses; a deployment may supply its own. */
export interface TaskBoardExtensionLogger {
  warn(message: string, ...rest: unknown[]): void
  error(message: string, ...rest: unknown[]): void
}

/** The deployment's model-visible tool registry, resolved lazily. */
export interface TaskBoardExtensionToolRegistry {
  register(definition: ToolDefinition): () => void
}

/** Applies one board action with every board gate intact (never an extension action). */
export type TaskBoardActionApplier = (action: Exclude<TaskBoardAction, { kind: 'extension-action' }>, initiator?: string) => TaskBoardSnapshot

/** Registry dependencies. */
export interface TaskBoardExtensionRegistryOptions {
  ledger: HostTaskLedger
  /** Apply an action through the board service (gates, run dispatch, schedule). */
  apply?: TaskBoardActionApplier
  /** Resolve the deployment's tool registry; absent loses the tool surface only. */
  toolRegistry?: () => TaskBoardExtensionToolRegistry | undefined
  now?: () => number
  uuid?: () => string
  logger?: TaskBoardExtensionLogger
}

/** Event subscription callback, erased because one entry owns three families. */
type RegistryEventCallback = (event: unknown) => void

/** One registered provider. */
interface RegistryEntry {
  readonly extension: TaskBoardExtension
  /** Whether provider-side work is currently started (board x extension gate). */
  active: boolean
  /** Live event subscriptions, one set per event family. */
  readonly subscriptions: Record<keyof TaskBoardEventFace, Set<RegistryEventCallback>>
  /** Tool definitions the provider registered, with their live disposers. */
  tools: Array<{ definition: ToolDefinition; dispose?: () => void }>
  published?: TaskBoardExtensionPayload
}

const DEFAULT_LOGGER: TaskBoardExtensionLogger = {
  warn(message: string, ...rest: unknown[]): void {
    try { console.warn(message, ...rest) } catch { /* best-effort */ }
  },
  error(message: string, ...rest: unknown[]): void {
    try { console.error(message, ...rest) } catch { /* best-effort */ }
  },
}

/**
 * Whether a tool registration was refused because the deployment's fiber is
 * already unloading, rather than because the registry rejected the definition.
 * cordis reports that refusal as `INACTIVE_EFFECT` on the thrown error, and it
 * is the expected answer to any registration a shutdown path makes too late: the
 * teardown releases those tools moments later, so a refusal reports nothing.
 * Detected by the documented error code, which keeps the board free of any
 * runtime dependency on the host framework.
 *
 * @param error - the refusal the tool registry raised.
 * @returns true when the host context is already disposing.
 */
function isInactiveContext(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'INACTIVE_EFFECT'
}

function emptySubscriptions(): Record<keyof TaskBoardEventFace, Set<RegistryEventCallback>> {
  return {
    onStatusChanged: new Set(),
    onExecutionSettled: new Set(),
    onTaskDeleted: new Set(),
  }
}

/**
 * Shallow-merge one provider payload, dropping keys explicitly cleared with
 * undefined so a provider can remove a field without replacing the entry.
 */
function mergePayload(
  current: TaskBoardExtensionPayload | undefined,
  patch: TaskBoardExtensionPayload,
): TaskBoardExtensionPayload {
  const next: TaskBoardExtensionPayload = { ...(current ?? {}) }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete next[key]
    else next[key] = value
  }
  return next
}

/** Whether a stored integration entry is a usable extension payload. */
function readPayload(value: unknown): TaskBoardExtensionPayload | undefined {
  return isTaskBoardExtensionPayload(value) ? value : undefined
}

export class TaskBoardExtensionRegistry {
  private readonly entries = new Map<string, RegistryEntry>()
  private readonly ledger: HostTaskLedger
  private readonly applyAction: TaskBoardActionApplier | undefined
  private readonly now: () => number
  private readonly uuid: () => string
  private readonly logger: TaskBoardExtensionLogger
  private toolResolver: (() => TaskBoardExtensionToolRegistry | undefined) | undefined
  /** Board master switch (enabled config); providers start only while it is on. */
  private boardEnabled = true
  private disposed = false

  constructor(options: TaskBoardExtensionRegistryOptions) {
    this.ledger = options.ledger
    this.applyAction = options.apply
    this.now = options.now ?? Date.now
    this.uuid = options.uuid ?? (() => crypto.randomUUID())
    this.logger = options.logger ?? DEFAULT_LOGGER
    this.toolResolver = options.toolRegistry
  }

  /**
   * Pin (or replace) the deployment's tool registry. A registry that appears
   * after a provider started is picked up here, which is what keeps the tool
   * surface alive across the board's own late service resolution.
   */
  setToolRegistry(resolver: (() => TaskBoardExtensionToolRegistry | undefined) | undefined): void {
    this.toolResolver = resolver
    // The resolver may now name a different registry (the deployment replaced
    // its tool provider fiber): release what the previous one held and let
    // syncTools adopt the current one.
    for (const entry of this.entries.values()) {
      this.disposeTools(entry)
      this.syncTools(entry)
    }
  }

  /** Apply the board's master switch; providers start and stop with it. */
  setEnabled(enabled: boolean): void {
    this.boardEnabled = enabled
    for (const entry of this.entries.values()) this.reconcile(entry)
  }

  /** Whether the board currently runs a given extension (board x extension). */
  isActive(extensionId: string): boolean {
    return this.entries.get(extensionId)?.active === true
  }

  /**
   * Admit one provider. Idempotent by id: a second registration of the same id
   * is a no-op that returns the same release handle. A contract-version
   * mismatch is refused visibly (logged and thrown) without disturbing the
   * board or any other provider.
   * @param extension - the provider to admit.
   * @returns a disposer releasing the registration (idempotent).
   */
  registerExtension(extension: TaskBoardExtension): () => void {
    if (this.disposed) throw new TaskBoardExtensionError('registry-disposed', 'the board is shutting down')
    const existing = this.entries.get(extension.id)
    if (existing !== undefined) {
      if (existing.extension !== extension) {
        this.logger.warn(`[dsh-task-board] extension "${extension.id}" is already registered; the second registration is ignored`)
      }
      return () => { this.unregister(extension.id) }
    }
    if (extension.apiVersion !== TASK_BOARD_API_VERSION) {
      const message = `extension "${extension.id}" declares apiVersion ${String(extension.apiVersion)} but this board serves ${TASK_BOARD_API_VERSION}`
      this.logger.error('[dsh-task-board] ' + message)
      throw new TaskBoardExtensionError('api-version-mismatch', message)
    }
    const entry: RegistryEntry = { extension, active: false, subscriptions: emptySubscriptions(), tools: [] }
    this.entries.set(extension.id, entry)
    this.reconcile(entry)
    return () => { this.unregister(extension.id) }
  }

  /** Remove one provider; its provider-side work stops and its payload stays stored. */
  unregister(extensionId: string): void {
    const entry = this.entries.get(extensionId)
    if (entry === undefined) return
    this.stopEntry(entry)
    this.entries.delete(extensionId)
  }

  /**
   * Route one dispatched provider action. Refuses visibly when the extension is
   * unknown, currently gated off, or does not implement the action.
   */
  async handleAction(request: TaskBoardExtensionActionRequest): Promise<unknown> {
    const entry = this.entries.get(request.extensionId)
    if (entry === undefined) {
      throw new TaskBoardExtensionError('unknown-extension', `no extension "${request.extensionId}" is registered`)
    }
    if (!entry.active) {
      throw new TaskBoardExtensionError('extension-disabled', `extension "${request.extensionId}" is not enabled`)
    }
    const handler = entry.extension.handleAction
    if (typeof handler !== 'function') {
      throw new TaskBoardExtensionError('unsupported-action', `extension "${request.extensionId}" handles no actions`)
    }
    return await handler.call(entry.extension, request)
  }

  /** Published summaries of currently running providers, keyed by extension id. */
  published(): Record<string, TaskBoardExtensionPayload> {
    const result: Record<string, TaskBoardExtensionPayload> = {}
    for (const [id, entry] of this.entries) {
      if (entry.active && entry.published !== undefined) result[id] = entry.published
    }
    return result
  }

  /** Fan a status change out to every running provider, isolated per callback. */
  emitStatusChanged(event: TaskBoardStatusChangedEvent): void {
    this.emit('onStatusChanged', event)
  }

  /** Fan an execution settlement out to every running provider. */
  emitExecutionSettled(event: TaskBoardExecutionSettledEvent): void {
    this.emit('onExecutionSettled', event)
  }

  /** Fan a task deletion out to every running provider. */
  emitTaskDeleted(event: TaskBoardTaskDeletedEvent): void {
    this.emit('onTaskDeleted', event)
  }

  /** Stop every provider and release the registry (idempotent). */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const entry of this.entries.values()) this.stopEntry(entry)
    this.entries.clear()
  }

  // --- internals ---------------------------------------------------------------

  private emit(kind: keyof TaskBoardEventFace, payload: unknown): void {
    if (this.disposed) return
    for (const entry of this.entries.values()) {
      if (!entry.active) continue
      for (const callback of [...entry.subscriptions[kind]]) {
        try {
          callback(payload)
        } catch (error) {
          this.logger.error(`[dsh-task-board] extension "${entry.extension.id}" ${kind} callback failed`, error)
        }
      }
    }
  }

  /** Start or stop one entry against the current board + extension gate. */
  private reconcile(entry: RegistryEntry): void {
    if (this.disposed) return
    const wanted = this.boardEnabled && (entry.extension.enabled?.() ?? true)
    if (wanted === entry.active) {
      if (wanted) this.syncTools(entry)
      return
    }
    if (wanted) this.startEntry(entry)
    else this.stopEntry(entry)
  }

  private startEntry(entry: RegistryEntry): void {
    entry.active = true
    try {
      entry.extension.start?.(this.capabilities(entry))
    } catch (error) {
      this.logger.error(`[dsh-task-board] extension "${entry.extension.id}" start() failed`, error)
    }
    this.syncTools(entry)
  }

  private stopEntry(entry: RegistryEntry): void {
    if (entry.active) {
      entry.active = false
      for (const kind of Object.keys(entry.subscriptions) as Array<keyof TaskBoardEventFace>) {
        entry.subscriptions[kind].clear()
      }
      try {
        entry.extension.stop?.()
      } catch (error) {
        this.logger.error(`[dsh-task-board] extension "${entry.extension.id}" stop() failed`, error)
      }
    }
    this.disposeTools(entry)
    // A stopped provider re-registers its tools from start(); keeping the old
    // definitions would double-register them on the next enable.
    entry.tools.length = 0
  }

  /** (Re)register every buffered tool against the current tool registry. */
  private syncTools(entry: RegistryEntry): void {
    if (!entry.active) return
    const registry = this.toolResolver?.()
    for (const tool of entry.tools) {
      if (registry === undefined) {
        tool.dispose = undefined
        continue
      }
      if (tool.dispose !== undefined) continue
      try {
        tool.dispose = registry.register(tool.definition)
      } catch (error) {
        tool.dispose = undefined
        // A refusal from a host that is already unloading is the expected answer
        // to a registration the teardown made too late, not a fault of the tool
        // definition; only a real refusal of the definition is reported.
        if (isInactiveContext(error)) return
        this.logger.error(`[dsh-task-board] extension "${entry.extension.id}" tool "${tool.definition.name}" registration failed`, error)
      }
    }
  }

  private disposeTools(entry: RegistryEntry): void {
    for (const tool of entry.tools) {
      const dispose = tool.dispose
      tool.dispose = undefined
      if (dispose === undefined) continue
      try { dispose() } catch (error) { this.logger.error('[dsh-task-board] tool disposer failed', error) }
    }
  }

  private assertActive(entry: RegistryEntry, what: string): void {
    if (this.disposed) throw new TaskBoardExtensionError('registry-disposed', 'the board is shutting down')
    if (!entry.active) throw new TaskBoardExtensionError('extension-disabled', `extension "${entry.extension.id}" cannot ${what} while disabled`)
  }

  /** Build the per-extension capability face. */
  private capabilities(entry: RegistryEntry): TaskBoardExtensionHost {
    const id = entry.extension.id
    const assertActive = (what: string): void => { this.assertActive(entry, what) }
    const subscribe = (kind: keyof TaskBoardEventFace, callback: RegistryEventCallback): (() => void) => {
      assertActive('subscribe')
      entry.subscriptions[kind].add(callback)
      return () => { entry.subscriptions[kind].delete(callback) }
    }
    const tasks: TaskBoardTasksFace = {
      list: () => this.ledger.allTasks(),
      get: taskId => this.ledger.getTask(taskId),
      create: (draft, options) => this.createTask(entry, draft, options),
      patchContent: (taskId, patch) => this.patchContent(entry, taskId, patch),
      setStatus: (taskId, status, initiator) => this.setStatus(entry, taskId, status, initiator),
      linked: () => this.linkedTasks(entry),
    }
    const integration: TaskBoardIntegrationFace = {
      read: (taskId) => {
        assertActive('read')
        return readPayload(this.ledger.getTask(taskId)?.integrations?.[id])
      },
      write: (taskId, payload) => { this.writeIntegration(entry, taskId, payload) },
    }
    const events: TaskBoardEventFace = {
      onStatusChanged: (callback) => subscribe('onStatusChanged', callback as RegistryEventCallback),
      onExecutionSettled: (callback) => subscribe('onExecutionSettled', callback as RegistryEventCallback),
      onTaskDeleted: (callback) => subscribe('onTaskDeleted', callback as RegistryEventCallback),
    }
    return {
      tasks,
      integration,
      events,
      publish: (summary) => { this.publish(entry, summary) },
      registerTool: (definition) => { assertActive('register a tool'); return this.registerTool(entry, definition) },
    }
  }

  private createTask(entry: RegistryEntry, draft: { title: string; description: string; prompt: string; status?: TaskStatus; parentId?: string; workspaceId?: string }, options?: TaskBoardCreateOptions): TaskRecord {
    this.assertActive(entry, 'create a task')
    if (this.applyAction === undefined) throw new TaskBoardExtensionError('unavailable', 'this deployment serves no action applier')
    if (draft.status !== undefined && !isTaskStatus(draft.status)) throw new TaskBoardExtensionError('invalid-status', 'unknown task status')
    const payload = options?.payload
    if (payload !== undefined && !isTaskBoardExtensionPayload(payload)) {
      throw new TaskBoardExtensionError('invalid-payload', 'create payload must be a pure JSON object within the size limit')
    }
    const recordId = this.uuid()
    const snapshot = this.applyAction({
      kind: 'create',
      id: recordId,
      input: {
        title: draft.title,
        description: draft.description,
        prompt: draft.prompt,
        ...(draft.status === undefined ? {} : { status: draft.status }),
        ...(draft.parentId === undefined ? {} : { parentId: draft.parentId }),
        ...(draft.workspaceId === undefined ? {} : { workspaceId: draft.workspaceId }),
        ...(payload === undefined ? {} : { integrations: { [entry.extension.id]: payload } }),
        ...(options?.hidden === true ? { hidden: true } : {}),
      },
    })
    const task = snapshot.tasks.find(item => item.id === recordId)
    if (task === undefined) throw new TaskBoardExtensionError('create-refused', 'the board refused the task')
    return task
  }

  private patchContent(entry: RegistryEntry, taskId: string, patch: { title?: string; description?: string; prompt?: string }): void {
    this.assertActive(entry, 'patch content')
    if (this.applyAction === undefined) throw new TaskBoardExtensionError('unavailable', 'this deployment serves no action applier')
    const task = this.ledger.getTask(taskId)
    if (task === undefined) throw new TaskBoardExtensionError('task-not-found', `no task with id ${taskId}`)
    // The board's own content authority: an executed (or archived) card keeps
    // the title/description/prompt that were actually planned and run.
    if (!canEditTaskContent(task)) throw new TaskBoardExtensionError('content-frozen', `task ${taskId} has started executing; its content is read-only`)
    const keys = (['title', 'description', 'prompt'] as const).filter(field => patch[field] !== undefined)
    if (keys.length === 0) return
    this.applyAction({ kind: 'update', taskId, patch: { ...patch } })
  }

  private setStatus(entry: RegistryEntry, taskId: string, status: TaskStatus, initiator?: string): void {
    this.assertActive(entry, 'set a status')
    if (this.applyAction === undefined) throw new TaskBoardExtensionError('unavailable', 'this deployment serves no action applier')
    if (!isTaskStatus(status)) throw new TaskBoardExtensionError('invalid-status', 'unknown task status')
    // The board's existing move gates (running lock, archived lock, manual
    // column set) decide; a refusal surfaces unchanged.
    this.applyAction({ kind: 'move', taskId, status }, initiator)
  }

  private linkedTasks(entry: RegistryEntry): readonly TaskBoardLinkedTask[] {
    const id = entry.extension.id
    const result: TaskBoardLinkedTask[] = []
    for (const task of this.ledger.allTasks()) {
      const payload = readPayload(task.integrations?.[id])
      if (payload === undefined) continue
      result.push({ task, payload })
    }
    return result
  }

  private writeIntegration(entry: RegistryEntry, taskId: string, payload: TaskBoardExtensionPayload): void {
    this.assertActive(entry, 'write integration data')
    if (!isTaskBoardExtensionPayload(payload)) {
      throw new TaskBoardExtensionError('invalid-payload', 'integration payload must be a pure JSON object within the size limit')
    }
    const task = this.ledger.getTask(taskId)
    if (task === undefined) throw new TaskBoardExtensionError('task-not-found', `no task with id ${taskId}`)
    const id = entry.extension.id
    const next = mergePayload(readPayload(task.integrations?.[id]), payload)
    if (!isTaskBoardExtensionPayload(next)) {
      throw new TaskBoardExtensionError('invalid-payload', `merged integration payload for ${id} exceeds ${taskBoardPayloadBytes(next) ?? '?'} bytes`)
    }
    this.ledger.saveTaskRecord({
      ...task,
      updatedAt: this.now(),
      integrations: { ...(task.integrations ?? {}), [id]: next },
    })
  }

  private publish(entry: RegistryEntry, summary: TaskBoardExtensionPayload): void {
    this.assertActive(entry, 'publish a summary')
    if (!isTaskBoardExtensionPayload(summary)) {
      throw new TaskBoardExtensionError('invalid-payload', 'published summary must be a pure JSON object within the size limit')
    }
    entry.published = summary
  }

  private registerTool(entry: RegistryEntry, definition: ToolDefinition): () => void {
    const tool: { definition: ToolDefinition; dispose?: () => void } = { definition }
    entry.tools.push(tool)
    this.syncTools(entry)
    return () => {
      const index = entry.tools.indexOf(tool)
      if (index === -1) return
      entry.tools.splice(index, 1)
      const dispose = tool.dispose
      tool.dispose = undefined
      if (dispose !== undefined) {
        try { dispose() } catch (error) { this.logger.error('[dsh-task-board] tool disposer failed', error) }
      }
    }
  }
}
