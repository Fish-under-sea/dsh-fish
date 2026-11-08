import { type CardDefaults } from '../card-defaults.ts';
import { type NewTaskInput, type TaskRecord } from '../tasks.ts';
/** Result of a create transition: the new task (when accepted) + the next ledger. */
export interface CreateTaskResult {
    /** The minted task, or undefined when the input was rejected. */
    task: TaskRecord | undefined;
    /** The next ledger; identical reference when rejected. */
    tasks: readonly TaskRecord[];
    /** Why the input was rejected; absent when a task was minted. */
    error?: string;
}
/**
 * Apply a create against the current ledger. Returns the new task and the
 * appended ledger, or the unchanged ledger when the title is blank or the
 * requested parent link is refused.
 *
 * The execution targets resolve through {@link resolveCardTargets}: what the
 * caller sent wins, then the parent's own pins, then - only when the caller
 * opted in with `applyCardDefaults` - the deployment's configured new-card
 * defaults. Without the flag the resolution sees no defaults at all, which is
 * exactly the inline parent inheritance this path has always applied. The
 * workspace is not part of that resolution: a subtask still takes the parent's
 * workspace, and the defaults never name one.
 * @param tasks - current ledger.
 * @param input - raw user input (title/description/prompt + optional schedule/parent).
 * @param now - clock instant (ms epoch).
 * @param id - minted task id.
 * @param maxSubtaskDepth - deployment subtask depth limit.
 * @param hostTimeZone - zone a rule that stores no zone of its own follows.
 * @param cardDefaults - the deployment's new-card defaults, read live at creation.
 */
export declare function applyCreateTask(tasks: readonly TaskRecord[], input: NewTaskInput, now: number, id: string, maxSubtaskDepth?: number, hostTimeZone?: string, cardDefaults?: CardDefaults): CreateTaskResult;
