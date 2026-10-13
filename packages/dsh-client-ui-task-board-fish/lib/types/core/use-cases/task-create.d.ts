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
 * A subtask inherits the execution targets its parent already pins (workspace,
 * agent preset, permission, model) unless the form supplied its own; the
 * parent human permission confirmation travels with an inherited permission,
 * so a subtask of an already-confirmed elevated card is runnable at once.
 * @param tasks - current ledger.
 * @param input - raw user input (title/description/prompt + optional schedule/parent).
 * @param now - clock instant (ms epoch).
 * @param id - minted task id.
 * @param maxSubtaskDepth - deployment subtask depth limit.
 * @param hostTimeZone - zone a rule that stores no zone of its own follows.
 */
export declare function applyCreateTask(tasks: readonly TaskRecord[], input: NewTaskInput, now: number, id: string, maxSubtaskDepth?: number, hostTimeZone?: string): CreateTaskResult;
