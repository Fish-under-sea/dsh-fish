/**
 * The family health ledger's degraded-record contract (issues #1528, #1730).
 *
 * A family plugin row that fails during apply is recorded by the dsh-web-all
 * shell as a degraded record; the shell serves the ledger through its
 * loopback-only `GET /api/dsh-web-all/degraded` route because the failed
 * plugin could not register any route of its own — the task board whose ledger
 * lock is held by another DSH process is exactly that case, and without this
 * the panel could only report "the Host API is not mounted".
 *
 * Both halves define this shape: the shell WRITES it (packages/dsh-web-all,
 * src/degraded.ts — the two packages have no import edge, one is bundled into
 * the other's profile) and a plugin's browser half PARSES it. The edits move
 * together.
 */

/** Where a degraded row failed: module import, plugin shape, or fiber start. */
export type DegradedStage = 'import' | 'shape' | 'start'

/** One degraded family row as the shell's health route serves it. */
export interface DegradedRow {
  /** Real plugin package name from the shell row config. */
  plugin: string
  /** Where the failure happened. */
  stage: DegradedStage
  /** The shell's one-line reason, for display. */
  reason: string
}

/**
 * The one degraded record naming `plugin`, or undefined when that row is not
 * degraded (or the payload does not come from the shell's own shape). A
 * plugin may appear once: the shell keys the ledger by package name and
 * refreshes the record on every new failure.
 * @param body - parsed JSON body of the health route.
 * @param plugin - the real plugin package name to look for.
 * @returns the degraded row, or undefined when the ledger does not name it.
 */
export function degradedRowOf(body: unknown, plugin: string): DegradedRow | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const ledger = (body as { ok?: unknown; degraded?: unknown })
  if (ledger.ok !== true || !Array.isArray(ledger.degraded)) return undefined
  for (const entry of ledger.degraded) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as { plugin?: unknown; stage?: unknown; reason?: unknown }
    if (record.plugin !== plugin) continue
    const stage = record.stage === 'import' || record.stage === 'shape' || record.stage === 'start' ? record.stage : undefined
    if (stage === undefined) continue
    return { plugin, stage, reason: typeof record.reason === 'string' ? record.reason : '' }
  }
  return undefined
}

/** The ledger owner pid a task-board lock reason names, when it names one. */
const OWNED_BY_PROCESS_RE = /already owned by process\s+(\d+)/

/**
 * The marker the ledger appends when it could NOT confirm the recorded PID
 * belongs to the lock's real owner: the PID was reused by an unrelated process
 * after a crash, and the reason then carries the manual-removal step instead.
 * That reason must be rendered verbatim — telling the user to close "the other
 * DSH instance" would send them after a process that never touched the board.
 */
const UNCONFIRMED_OWNER_MARKER = 'reused after a crash'

/**
 * Extract the pid of the LIVE process a ledger-lock failure blames, when the
 * reason identifies one. The task board's lock refusal is the one degraded
 * reason that carries an owner the user can act on, so the panel renders the
 * pid in its own sentence and adds the guidance that actually applies.
 * @param reason - the shell's one-line failure reason.
 * @returns the confirmed owner pid, or undefined when the reason names none or
 *   warns that the PID may have been reused (its own text owns the recovery).
 */
export function ledgerOwnerPid(reason: string): number | undefined {
  if (reason.includes(UNCONFIRMED_OWNER_MARKER)) return undefined
  const match = OWNED_BY_PROCESS_RE.exec(reason)
  if (match === null) return undefined
  const pid = Number(match[1])
  return Number.isSafeInteger(pid) && pid > 0 ? pid : undefined
}
