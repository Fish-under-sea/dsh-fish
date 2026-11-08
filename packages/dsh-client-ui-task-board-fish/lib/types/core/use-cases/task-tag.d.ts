/**
 * Label-management use cases (issue: labels could not be cleaned up).
 *
 * A label lives on every task that carries it, so renaming or removing one is a
 * ledger-wide edit, not a task edit: the board's label row is the union of the
 * labels in use, and without these two transitions a label created by an
 * afternoon experiment stayed on the board forever.
 *
 * Both transitions are pure ledger rewrites (no persistence, no notify — the
 * controller and the Host ledger orchestrate those), and both are idempotent:
 * a label that no task carries changes nothing and reports no error for the
 * delete path (the desired end state already holds), while a rename from an
 * unknown label is refused so a stale tab cannot silently do nothing.
 *
 * Renaming onto a name that is already in use MERGES the two: a task carrying
 * both keeps the row it already had (with its execution hint) and loses the
 * duplicate, which is the only reading that cannot lose a hint the user typed.
 *
 * Clearing up is the third ledger-wide transition, and it is a SELECTION rather
 * than a fourth rewrite: {@link cleanupCandidates} names the labels that are
 * both rarely used and attached only to finished tasks, and each of them then
 * leaves through {@link applyDeleteTag} like any other delete. One delete path,
 * one meaning — a label never disappears by a second rule written beside the
 * first.
 */
import { type TaskRecord } from '../tasks.ts';
/** Outcome of one ledger-wide label edit. */
export interface TagEditResult {
    /** The ledger after the edit, or the input unchanged when nothing applied. */
    tasks: readonly TaskRecord[];
    /** Whether any task actually changed (drives whether the caller persists). */
    changed: boolean;
    /** Refusal reason; the ledger is unchanged when set. */
    error?: string;
}
/**
 * Rename one label everywhere, merging into an existing label of the target
 * name. Every touched task gets a fresh updatedAt; untouched tasks keep theirs.
 * @param tasks - current ledger.
 * @param from - the label to rename.
 * @param to - the new name (an existing name merges the two labels).
 * @param now - clock instant (ms epoch).
 * @returns the rewritten ledger, or a refusal.
 */
export declare function applyRenameTag(tasks: readonly TaskRecord[], from: string, to: string, now: number): TagEditResult;
/**
 * Remove one label from every task that carries it. Archived cards are included:
 * the board's label row draws from the whole ledger, so a label left on an
 * archived card would come straight back into the filter.
 * @param tasks - current ledger.
 * @param name - the label to remove.
 * @param now - clock instant (ms epoch).
 * @returns the rewritten ledger.
 */
export declare function applyDeleteTag(tasks: readonly TaskRecord[], name: string, now: number): TagEditResult;
/** One label the manager offers to clear, with the tasks it would be taken from. */
export interface TagCleanupCandidate {
    /** The label name. */
    name: string;
    /** Tasks carrying the label right now, board and archive alike. */
    count: number;
}
/**
 * Labels that are both rarely used and finished with: fewer tasks carry them
 * than `threshold`, and every one of those tasks is done or failed.
 *
 * The judgement reads the whole ledger it is given — the board's label row and
 * the archive draw from the same set, so an archived card counts towards a
 * label's usage and can keep it alive on its own. Archiving alone decides
 * nothing: an archived card in a finished column lets its label through, while
 * an archived card still in backlog, todo or running holds it back, because a
 * label that live work still points at is not junk.
 *
 * A non-finite threshold selects nothing (a missing number has no reading that
 * is safe to act on); a threshold at or below one selects nothing either, since
 * a label by definition sits on at least one task and none can carry fewer.
 *
 * Order follows {@link collectKnownTags}, which is the order the manager lists
 * labels in, and the count is the same number the manager shows per label.
 * @param tasks - the whole ledger (board and archive).
 * @param threshold - exclusive upper bound on the usage count.
 * @returns the labels a cleanup may remove, in listing order.
 */
export declare function cleanupCandidates(tasks: readonly TaskRecord[], threshold: number): TagCleanupCandidate[];
