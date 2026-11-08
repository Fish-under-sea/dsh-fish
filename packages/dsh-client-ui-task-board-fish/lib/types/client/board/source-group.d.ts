/**
 * Source grouping and fold preferences for the board view. Providers contribute
 * opaque groups through the client contract; this module owns only ordering,
 * local fallback, and browser persistence, never provider metadata semantics.
 */
import type { TaskBoardGroupingSelector, TaskBoardSourceGroup } from '../../core/extension.ts';
import type { TaskRecord, TaskStatus } from '../../core/tasks.ts';
/** Reserved group for cards no provider claimed. */
export declare const LOCAL_SOURCE_GROUP_ID = "local";
/** Browser storage key for explicit source-fold overrides. */
export declare const SOURCE_GROUP_FOLDS_KEY = "dsh.taskBoard.sourceGroupFolds.v1";
export type SourceGroupView = TaskStatus | 'archived';
export type SourceGroupFolds = Readonly<Record<string, boolean>>;
export interface SourceGroupBucket extends TaskBoardSourceGroup {
    items: TaskRecord[];
    local: boolean;
}
/** Group cards in their incoming order, then sort provider groups by full label. */
export declare function groupTasksBySource(tasks: readonly TaskRecord[], selectors: readonly TaskBoardGroupingSelector[]): SourceGroupBucket[];
/** Compound key keeps a fold choice scoped to one column/view and one source. */
export declare function sourceGroupFoldKey(view: SourceGroupView, sourceId: string): string;
/** Read explicit overrides; malformed or unavailable storage falls back to defaults. */
export declare function readSourceGroupFolds(storage: Pick<Storage, 'getItem'> | undefined): SourceGroupFolds;
/** Persist overrides; a storage failure only loses the preference. */
export declare function writeSourceGroupFolds(storage: Pick<Storage, 'setItem'> | undefined, folds: SourceGroupFolds): void;
/** Search always reveals matches; otherwise an override beats the column default. */
export declare function isSourceGroupFolded(folds: SourceGroupFolds, view: SourceGroupView, sourceId: string, searchActive: boolean): boolean;
