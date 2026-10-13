/**
 * Automatic policy candidate rules. The time basis is fixed here in one
 * place: auto-archive reads the authoritative last-activity time (never the
 * creation time, never a file timestamp); auto-delete reads the recorded
 * archive time (never the file mtime, never the scan time) and requires that
 * time to be known — sessions archived before this plugin existed (unknown
 * archive time) are never auto-deleted.
 * @module @fish-under-sea/dsh-session-archive-fish/core/auto-rules
 */

import type { ArchiveSessionRow } from './types.ts'

export const DAY_MS = 86_400_000

/**
 * Sessions eligible for auto-archive: unarchived, reliable last activity,
 * inactive longer than the threshold, and not protected. Blank sessions are
 * eligible (archiving hides an empty session without destroying anything);
 * the current and running sessions are protected upstream of this predicate.
 */
export function autoArchiveCandidates(
  rows: readonly ArchiveSessionRow[],
  options: { days: number; now: number; protectedIds: ReadonlySet<string> },
): { id: string; lastActivityAt: number }[] {
  const threshold = options.days * DAY_MS
  const candidates: { id: string; lastActivityAt: number }[] = []
  for (const row of rows) {
    if (row.archived) continue
    if (!row.lastActivityReliable || row.lastActivityAt === undefined) continue
    if (options.protectedIds.has(row.id)) continue
    if (options.now - row.lastActivityAt <= threshold) continue
    candidates.push({ id: row.id, lastActivityAt: row.lastActivityAt })
  }
  candidates.sort((a, b) => a.lastActivityAt - b.lastActivityAt)
  return candidates
}

/**
 * Sessions eligible for auto-delete BEFORE family-cascade planning: archived
 * with a KNOWN archive time, older than the retention threshold, and archived
 * strictly before this run started (a session archived by the same tick is
 * never deleted in that tick). Unknown archive times are excluded here, so
 * pre-plugin historical archives can only ever leave through a manual delete.
 */
export function autoDeleteSeedCandidates(
  rows: readonly ArchiveSessionRow[],
  options: { retainDays: number; now: number; runStartedAt: number; protectedIds: ReadonlySet<string> },
): { id: string; archivedAt: number; sizeBytes?: number }[] {
  const threshold = options.retainDays * DAY_MS
  const candidates: { id: string; archivedAt: number; sizeBytes?: number }[] = []
  for (const row of rows) {
    if (!row.archived || row.archivedAt === undefined) continue
    if (options.protectedIds.has(row.id)) continue
    if (row.archivedAt >= options.runStartedAt) continue
    if (options.now - row.archivedAt <= threshold) continue
    candidates.push({ id: row.id, archivedAt: row.archivedAt, ...(row.sizeBytes !== undefined ? { sizeBytes: row.sizeBytes } : {}) })
  }
  candidates.sort((a, b) => a.archivedAt - b.archivedAt)
  return candidates
}
