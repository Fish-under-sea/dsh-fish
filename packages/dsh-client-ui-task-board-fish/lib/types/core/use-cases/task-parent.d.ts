import type { TaskRecord } from '../tasks.ts';
/** Result of a parent-link transition. */
export interface SetParentResult {
    /** The next ledger; the input reference when refused. */
    tasks: readonly TaskRecord[];
    /** Whether the link (or the detachment) was stored. */
    applied: boolean;
    /** User-facing refusal reason; absent when applied. */
    error?: string;
}
/**
 * Attach or detach one task. A null (or blank) parent detaches, which is always
 * allowed for a known on-board task; attaching validates the whole chain so a
 * cyclic or too-deep ledger can never be stored.
 * @param tasks - current ledger.
 * @param id - the task being moved.
 * @param parentId - the new parent, or null to detach.
 * @param now - clock instant (ms epoch).
 * @param maxSubtaskDepth - deployment subtask depth limit.
 */
export declare function applySetParent(tasks: readonly TaskRecord[], id: string, parentId: string | null, now: number, maxSubtaskDepth?: number): SetParentResult;
