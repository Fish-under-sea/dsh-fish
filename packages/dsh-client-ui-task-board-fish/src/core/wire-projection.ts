/**
 * What an extension's `integrations` container looks like once it leaves the
 * Host.
 *
 * The container is provider-owned and crosses the board unread, and it also
 * crosses the wire: the HTTP snapshot, every action answer, and the remote
 * bridge's `board.snapshot` all carry it. A credential a provider stored there
 * would therefore reach every browser and phone paired to this Host. This
 * module is the one place that decides otherwise: the ledger keeps the payload
 * verbatim (the provider reads it back through its in-process capability face,
 * and a Host-side consumer reads the ledger itself), while the copy that leaves
 * carries no credential.
 *
 * @module dsh-task-board/core/wire-projection
 */
import type { TaskBoardSnapshot } from '../protocol.ts'
import type { TaskBoardExtensionPayload } from './extension.ts'
import type { TaskRecord } from './tasks.ts'

/**
 * Keys stripped from an integration payload at every depth, as whole keys and
 * compared case-insensitively.
 *
 * `leaseToken` is the name `dsh-task-board-team` writes for its mirror-card
 * lease and `lease_token` the snake spelling, while the rest are the generic
 * names a bearer credential hides under. The match is the whole key rather than
 * a substring: a payload field that merely mentions one of these words while
 * holding something the provider's own UI renders is not a credential and must
 * keep travelling.
 */
const CREDENTIAL_KEYS: ReadonlySet<string> = new Set([
  'leasetoken',
  'lease_token',
  'token',
  'secret',
  'password',
  'apikey',
  'credential',
])

/** Copy one JSON value with every credential-keyed entry removed, at any depth. */
function withoutCredentials(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutCredentials)
  if (value === null || typeof value !== 'object') return value
  const copy: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (CREDENTIAL_KEYS.has(key.toLowerCase())) continue
    copy[key] = withoutCredentials(entry)
  }
  return copy
}

/**
 * The card as the wire may show it: the ledger record with its integration
 * entries copied and stripped.
 *
 * A card that carries no integrations is returned untouched, so a provider that
 * stores nothing sees exactly the record the board has always published.
 * @param task - the ledger record about to be serialized.
 * @returns the projected record; the ledger object is never mutated.
 */
export function projectTaskForWire(task: TaskRecord): TaskRecord {
  const stored = task.integrations
  if (stored === undefined) return task
  const integrations: Record<string, TaskBoardExtensionPayload> = {}
  for (const [id, payload] of Object.entries(stored)) {
    integrations[id] = withoutCredentials(payload) as TaskBoardExtensionPayload
  }
  return { ...task, integrations }
}

/**
 * The snapshot as every read path serializes it: the HTTP `state` answer, the
 * HTTP `action` answer, and the remote bridge's `board.snapshot` all start from
 * the object this returns.
 * @param snapshot - the snapshot the Host service built from its live state.
 * @returns the same snapshot with each card projected through {@link projectTaskForWire}.
 */
export function projectSnapshotForWire(snapshot: TaskBoardSnapshot): TaskBoardSnapshot {
  return { ...snapshot, tasks: snapshot.tasks.map(projectTaskForWire) }
}
