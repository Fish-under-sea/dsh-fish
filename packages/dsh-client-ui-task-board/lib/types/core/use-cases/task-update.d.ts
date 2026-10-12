/**
 * Update-task use case: apply an editable-field patch (title/description/
 * prompt plus the execution targets workspaceId/mode/permission) with a
 * fresh updatedAt. Pure ledger transition (no persistence or notify — the
 * controller orchestrates those).
 *
 * An explicit `undefined` in the patch clears the field (the task falls
 * back to the runtime default); an unknown permission string is ignored so
 * stale UI can never persist a value the execution service rejects.
 */
import { type TaskRecord, type TaskTag } from '../tasks.ts';
import type { FreezeSnapshot } from '../freeze-snapshot.ts';
import type { TaskHandoverInput } from '../handover.ts';
/**
 * Editable fields on a task (the update patch surface). `freeze` replaces the
 * continuation-card snapshot (restamping frozenAt); an explicit null clears it.
 */
export type TaskUpdatePatch = Partial<Pick<TaskRecord, 'title' | 'description' | 'prompt' | 'workspaceId' | 'mode' | 'permission' | 'model' | 'reuseSession' | 'teamRun' | 'goalRun' | 'skipVerification'>> & {
    freeze?: FreezeSnapshot & {
        redacted?: boolean;
    } | null;
    /** Replaces the handover bundle (restamping bundledAt); an explicit null clears it. */
    handover?: TaskHandoverInput | null;
    /**
     * Replaces the task's labels (issue #1521). Unlike the content fields, tags
     * stay editable after the first run: they classify the task and shape the
     * NEXT execution prompt, they are not the record of what already ran. An
     * explicit null (or a list that normalizes to nothing) clears them.
     */
    tags?: TaskTag[] | null;
};
/** The fields that edit the task's content (what the user reads and what the
 * next execution sends). Unlike the execution targets they stay editable only
 * while the task has never started executing — after the first run the
 * recorded prompt is the record of what actually ran, so it becomes read-only.
 */
export declare const TASK_CONTENT_FIELDS: readonly ["title", "description", "prompt"];
/** Whether an update patch touches any task-content field. */
export declare function hasContentPatch(patch: TaskUpdatePatch): boolean;
/**
 * Whether a task's content may still be edited: the task must be on-board
 * (not archived) and must never have started executing. Fail-closed: a task
 * with any execution record — running, settled, or cancelled before launch —
 * keeps its content fixed. The run, not the column, is the trigger: a card
 * parked in 'running' by hand has nothing recorded yet and stays editable.
 */
export declare function canEditTaskContent(task: TaskRecord): boolean;
/**
 * Apply an update across the ledger. Tasks that do not match the id are left
 * untouched; the matched task receives the patch plus a fresh updatedAt.
 * @param tasks - current ledger.
 * @param id - the task to update.
 * @param patch - editable-field changes.
 * @param now - clock instant (ms epoch).
 */
export declare function applyUpdateTask(tasks: readonly TaskRecord[], id: string, patch: TaskUpdatePatch, now: number): readonly TaskRecord[];
