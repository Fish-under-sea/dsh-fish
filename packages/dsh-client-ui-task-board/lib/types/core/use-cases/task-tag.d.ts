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
