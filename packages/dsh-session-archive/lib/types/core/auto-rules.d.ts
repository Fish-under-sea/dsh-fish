/**
 * Automatic policy candidate rules. The time basis is fixed here in one
 * place: auto-archive reads the authoritative last-activity time (never the
 * creation time, never a file timestamp); auto-delete reads the recorded
 * archive time (never the file mtime, never the scan time) and requires that
 * time to be known — sessions archived before this plugin existed (unknown
 * archive time) are never auto-deleted.
 * @module @fish-under-sea/dsh-session-archive/core/auto-rules
 */
import type { ArchiveSessionRow } from './types.ts';
export declare const DAY_MS = 86400000;
/**
 * Sessions eligible for auto-archive: unarchived, reliable last activity,
 * inactive longer than the threshold, and not protected. Blank sessions are
 * eligible (archiving hides an empty session without destroying anything);
 * the current and running sessions are protected upstream of this predicate.
 */
export declare function autoArchiveCandidates(rows: readonly ArchiveSessionRow[], options: {
    days: number;
    now: number;
    protectedIds: ReadonlySet<string>;
}): {
    id: string;
    lastActivityAt: number;
}[];
/**
 * Sessions eligible for auto-delete BEFORE family-cascade planning: archived
 * with a KNOWN archive time, older than the retention threshold, and archived
 * strictly before this run started (a session archived by the same tick is
 * never deleted in that tick). Unknown archive times are excluded here, so
 * pre-plugin historical archives can only ever leave through a manual delete.
 */
export declare function autoDeleteSeedCandidates(rows: readonly ArchiveSessionRow[], options: {
    retainDays: number;
    now: number;
    runStartedAt: number;
    protectedIds: ReadonlySet<string>;
}): {
    id: string;
    archivedAt: number;
    sizeBytes?: number;
}[];
