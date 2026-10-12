import { type BoardController } from '../../core/controller.ts';
import { type TaskRecord } from '../../core/tasks.ts';
/** Sentinel option value of the project row's "register a new project" entry. */
export declare const NEW_PROJECT_VALUE = "__dsh_new_project__";
/**
 * Case-insensitive title/description/tag/freeze-snapshot/provider-payload match.
 *
 * A leading `#` is dropped from the needle. Providers render their own
 * identifiers with that prefix (`#1758`) and the board attaches no meaning to
 * it: stripping it keeps the identifier searchable exactly as it is written on
 * screen, without the board learning any provider's vocabulary.
 */
export declare function matchesFilter(task: TaskRecord, filter: string): boolean;
/**
 * Whether a task carries every selected label (issue #1521). Multi-select is
 * conjunctive: adding a label narrows the board instead of widening it, which
 * is the only reading that keeps "工作" selected from dragging unrelated cards
 * back in when a second label is added.
 */
export declare function matchesTagFilter(task: TaskRecord, selected: readonly string[]): boolean;
/** Cards a grouped column renders before the oldest group folds. */
export declare const COLUMN_FOLD_THRESHOLD = 30;
/** Board component; subscribes to the controller snapshot. */
export declare function TaskBoard({ controller }: {
    controller: BoardController;
}): import("react").JSX.Element;
