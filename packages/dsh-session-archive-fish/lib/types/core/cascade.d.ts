/**
 * Family cascade and delete planning over inventory rows. Pure logic shared
 * by the host (authoritative plan) and the browser half (confirm-dialog
 * preview), so the numbers a user confirms are computed by the same rules
 * the host enforces.
 * @module @fish-under-sea/dsh-session-archive-fish/core/cascade
 */
import type { ArchiveSessionRow, DeletePlanView } from './types.ts';
/** All descendants of one id via the `childIds` edges (excluding the id itself). */
export declare function descendantsOf(rows: readonly ArchiveSessionRow[], id: string): string[];
/**
 * Authoritative delete plan. Rules:
 * - A direct id missing from the inventory is skipped as `not-found`.
 * - A direct id that is itself protected is skipped with its own reason; its
 *   family is left untouched.
 * - A family (direct id plus all descendants) containing ANY protected member
 *   is skipped whole with `family-protected` — never a half-deleted family.
 * - Every id appears at most once in `skipped`; a directly selected protected
 *   id keeps its own reason even when a relative's family also covers it.
 * - Everything else in the union of safe families is deleted.
 */
export declare function planDelete(rows: readonly ArchiveSessionRow[], directIds: readonly string[], protectedReason: ReadonlyMap<string, string>): DeletePlanView;
/**
 * Protected-reason map for preview surfaces. `running` and `current` are the
 * two facts the browser half knows; the host adds `in-flight` and re-checks
 * everything authoritatively.
 */
export declare function clientProtectedReason(rows: readonly ArchiveSessionRow[], currentSessionId: string | undefined): Map<string, string>;
