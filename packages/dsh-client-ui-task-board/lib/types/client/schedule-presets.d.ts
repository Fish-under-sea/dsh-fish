/**
 * Shared scheduled-run presets for the schedule editors (the new-task dialog
 * and the task detail panel): cron expression → locale label.
 */
import type { TaskBoardKey } from './locales.ts';
/** Common scheduled-run presets (cron → locale label). */
export declare const SCHEDULE_PRESETS: ReadonlyArray<{
    cron: string;
    label: TaskBoardKey;
}>;
