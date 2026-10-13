import type { TaskRecord } from '../tasks.ts';
/** Result of an archive transition. */
export interface ArchiveTaskResult {
    /** The next ledger. */
    tasks: readonly TaskRecord[];
    /** Whether the archive was applied (false = unknown task / not archivable). */
    archived: boolean;
}
/**
 * Archive one task and its subtasks: only a running member keeps the group on
 * the board (its runner still owns its lifecycle until the execution settles);
 * any other status can be archived. Archiving disarms schedules; an
 * already-archived task is a no-op.
 */
export declare function applyArchiveTask(tasks: readonly TaskRecord[], id: string, now: number, maxSubtaskDepth?: number): ArchiveTaskResult;
/**
 * Restore one task back onto the main board, together with its ancestors (an
 * on-board subtask must not point at an archived parent) and its subtasks.
 */
export declare function applyRestoreTask(tasks: readonly TaskRecord[], id: string, now: number, maxSubtaskDepth?: number): ArchiveTaskResult;
