/**
 * Host-observed workspace changes, as acceptance evidence.
 *
 * The judge must not take the agent's word for what changed on disk: a patch
 * that was never applied, or a file edited again afterwards, looks identical to
 * a real edit when only the tool-call arguments are read. The DSH host records
 * what a turn actually changed and serves it through the optional
 * @@workspaceChanges@@ service, so that observation is offered next to the
 * trajectory instead of being trusted from the transcript.
 *
 * The service is described STRUCTURALLY and resolved optionally: a deployment
 * that serves none (or a cohort whose shape differs) degrades to "no extra
 * evidence" and never breaks an acceptance that has already spent judge budget.
 */
import { createHash } from 'node:crypto'

/** The subset of the host change service this module drives. */
export interface WorkspaceChangeSource {
  summary(sessionId: string, seq: number): unknown
  diff(sessionId: string, seq: number, index: number, signal: AbortSignal): Promise<unknown>
}

/** One session event, as the host log carries it. */
interface RawEvent {
  type?: unknown
  seq?: unknown
}

/** How many changed files one evidence block renders. */
export const MAX_WORKSPACE_FILES = 8
/** Character ceiling for the whole rendered block. */
export const WORKSPACE_EVIDENCE_MAX_CHARS = 24_000
/** Character ceiling for one file's rendered comparison. */
export const WORKSPACE_EVIDENCE_MAX_FILE_CHARS = 6_000

/**
 * Resolve the optional host change service from a context-like object.
 * @param ctx - anything exposing @@get(name)@@.
 * @returns the service, or undefined when this deployment serves none.
 */
export function probeWorkspaceChanges(ctx: { get(name: string): unknown }): WorkspaceChangeSource | undefined {
  let service: unknown
  try {
    service = ctx.get('workspaceChanges')
  } catch {
    return undefined
  }
  if (typeof service !== 'object' || service === null) return undefined
  const candidate = service as { summary?: unknown; diff?: unknown }
  if (typeof candidate.summary !== 'function' || typeof candidate.diff !== 'function') return undefined
  return service as WorkspaceChangeSource
}

/** Read a finite number, else 0. */
function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Read a string, else ''. */
function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Bound one text to a character budget, keeping the head. */
function bound(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value
  const notice = '\n[Truncated ' + (value.length - maxChars) + ' characters]'
  if (notice.length >= maxChars) return value.slice(0, maxChars)
  return value.slice(0, maxChars - notice.length) + notice
}

/** The sequence of the newest change event inside the reviewed window. */
export function latestChangeEvent(events: readonly RawEvent[]): { seq: number; turn?: number } | undefined {
  let latest: { seq: number; turn?: number } | undefined
  for (const event of events) {
    if (event.type !== 'workspace/changes') continue
    if (typeof event.seq !== 'number') continue
    if (latest === undefined || event.seq >= latest.seq) latest = { seq: event.seq }
  }
  return latest
}

/** Render one file's comparison from whatever shape the service answered. */
function renderDiff(value: unknown, maxChars: number): string {
  if (typeof value !== 'object' || value === null) return '[no comparison available]'
  const diff = value as Record<string, unknown>
  if (diff.binary === true || text(diff.kind) === 'binary') return '[binary file]'
  if (diff.oversized === true) return '[file too large to compare]'
  const patch = text(diff.patch)
  if (patch !== '') return bound(patch, maxChars)
  const hunks = Array.isArray(diff.hunks) ? diff.hunks : []
  const lines: string[] = []
  for (const entry of hunks) {
    if (typeof entry !== 'object' || entry === null) continue
    const hunk = entry as Record<string, unknown>
    lines.push('@@ -' + count(hunk.oldStart) + ',' + count(hunk.oldLines) + ' +' + count(hunk.newStart) + ',' + count(hunk.newLines) + ' @@')
    const body = Array.isArray(hunk.lines) ? hunk.lines : []
    for (const line of body) {
      if (typeof line === 'string') lines.push(line)
      else if (typeof line === 'object' && line !== null) {
        const row = line as Record<string, unknown>
        const marker = text(row.kind) === 'add' ? '+' : text(row.kind) === 'delete' ? '-' : ' '
        lines.push(marker + text(row.text))
      }
    }
  }
  return lines.length === 0 ? '' : bound(lines.join('\n'), maxChars)
}

/**
 * Render the host's own record of what the reviewed window changed.
 *
 * Bounded twice — at most {@link MAX_WORKSPACE_FILES} files, and a shared
 * character budget split across them — so one enormous generated file cannot
 * crowd out every other change. Every failure degrades to less evidence (or an
 * empty block) instead of an error, because the acceptance being prepared must
 * still reach a verdict.
 * @param events - session events already bounded to the execution's window.
 * @param sessionId - the session whose changes these are.
 * @param source - the probed host service.
 * @param options - budget, cancellation and the diagnostic sink.
 * @returns the rendered block plus how many files it shows.
 */
export async function renderWorkspaceEvidence(
  events: readonly RawEvent[],
  sessionId: string,
  source: WorkspaceChangeSource,
  options: { signal: AbortSignal; warn?: (message: string) => void; maxChars?: number },
): Promise<{ text: string; files: number; hash: string }> {
  const warn = options.warn ?? ((): void => {})
  const maxChars = options.maxChars ?? WORKSPACE_EVIDENCE_MAX_CHARS
  try {
    const event = latestChangeEvent(events)
    if (event === undefined) return { text: '', files: 0, hash: '' }
    const summary = source.summary(sessionId, event.seq)
    if (typeof summary !== 'object' || summary === null) return { text: '', files: 0, hash: '' }
    const view = summary as Record<string, unknown>
    const listed = (Array.isArray(view.files) ? view.files : [])
      .map((file, index) => ({ file, index }))
      .filter((entry): entry is { file: Record<string, unknown>, index: number } => typeof entry.file === 'object' && entry.file !== null)
    if (listed.length === 0) return { text: '', files: 0, hash: '' }
    const shown = listed.slice(0, MAX_WORKSPACE_FILES)
    const added = count(view.added)
    const deleted = count(view.deleted)
    const header = 'Host-recorded workspace changes'
      + (typeof view.turn === 'number' ? ' for turn ' + view.turn : '')
      + ': ' + listed.length + ' changed file(s)'
      + (added > 0 || deleted > 0 ? ' (+' + added + '/-' + deleted + ' lines)' : '')
      + (listed.length > shown.length ? '; showing the first ' + shown.length : '')
      + '.\nObserved by the DSH host from the workspace itself, not reported by the agent.'
    const perFile = Math.max(1, Math.min(WORKSPACE_EVIDENCE_MAX_FILE_CHARS, Math.floor((maxChars - header.length) / shown.length) - 40))
    const sections: string[] = []
    for (const entry of shown) {
      const path = text(entry.file.path) !== '' ? text(entry.file.path) : text(entry.file.display) !== '' ? text(entry.file.display) : 'file'
      const fileAdded = count(entry.file.added)
      const fileDeleted = count(entry.file.deleted)
      let comparison = ''
      try {
        comparison = renderDiff(await source.diff(sessionId, event.seq, entry.index, options.signal), perFile)
      } catch (error) {
        comparison = '[comparison unavailable]'
        warn('task-board workspace evidence unavailable for one file: ' + (error instanceof Error ? error.message : String(error)))
      }
      sections.push('- ' + path + (fileAdded > 0 || fileDeleted > 0 ? ' (+' + fileAdded + '/-' + fileDeleted + ')' : '') + '\n' + comparison)
    }
    const rendered = bound([header, ...sections].join('\n'), maxChars)
    return {
      text: rendered,
      files: shown.length,
      hash: createHash('sha256').update(rendered).digest('hex'),
    }
  } catch (error) {
    warn('task-board workspace evidence unavailable: ' + (error instanceof Error ? error.message : String(error)))
    return { text: '', files: 0, hash: '' }
  }
}
