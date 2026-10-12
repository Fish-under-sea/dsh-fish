/**
 * Card view model: the pure derivations a task card renders from its record.
 *
 * Everything here is a function of the task record (plus the clock and the
 * Host time zone for the recency groups), so the card stays a thin renderer and
 * every rule is unit-testable without mounting React. Nothing here writes the
 * record: the type prefix, the tone and the time label are presentation only.
 *
 * @module @fish-under-sea/dsh-client-ui-task-board/client/board/card-view
 */
import { type ExecutionOutcome, type ExecutionRecord, type TaskRecord, type TaskStatus } from '../../core/tasks.ts';
import type { TaskBoardKey } from '../locales.ts';
/** A title split into its bracketed type prefix and the remaining text. */
export interface TitleParts {
    /** Bracketed type prefix such as `Bug` from `[Bug]: ...`; absent when none. */
    kind?: string;
    /** Title text without the prefix (the whole title when there is no prefix). */
    text: string;
}
/**
 * Split an issue-form style type prefix off a title. The prefix becomes a
 * badge, so the clamped title lines carry the text the reader scans for. A
 * title that is only a prefix keeps its full text.
 * @param summary - the plain-text title.
 * @returns the prefix (when present) and the remaining title text.
 */
export declare function splitTitleKind(summary: string): TitleParts;
/** Stripe tone of a card: the state of its latest execution. */
export type CardTone = 'running' | ExecutionOutcome;
/** What the card reports about its latest execution. */
export interface CardOutcome {
    /** Stripe tone; absent on an archived card or a card that never ran. */
    tone?: CardTone;
    /** The latest execution record, when the card ran at least once. */
    latest?: ExecutionRecord;
    /**
     * The column disagrees with the latest settled run: a card in Done whose last
     * run did not succeed, or a card in Failed whose last run succeeded. The
     * column was then set by hand or by a provider (a closed issue), and the
     * card says so instead of letting a red run count read as a contradiction.
     */
    declared: boolean;
}
/**
 * Derive the card's execution outcome.
 * @param task - the task record.
 * @param archived - whether the card renders in the archive view.
 */
export declare function cardOutcome(task: TaskRecord, archived: boolean): CardOutcome;
/** Locale key of the latest settled result shown before the run count. */
export declare const RESULT_KEY: Record<ExecutionOutcome, TaskBoardKey>;
/** The one time a card shows, and what that time means. */
export interface CardTimeline {
    /** Locale key with a `{time}` placeholder. */
    key: TaskBoardKey;
    /** The instant (ms epoch). */
    at: number;
}
/**
 * Pick the time that tells cards in the same column apart. `updatedAt` moves
 * on every provider sync, so a column of synced cards would all read
 * "updated 4m"; each column instead shows the instant its cards differ by:
 * planning columns the creation time, an executing card its start, settled
 * columns the latest run's settlement, the archive the archive time.
 * @param task - the task record.
 * @param archived - whether the card renders in the archive view.
 */
export declare function cardTimeline(task: TaskRecord, archived: boolean): CardTimeline;
/** Recency bucket of a settled card. */
export type RecencyGroup = 'today' | 'week' | 'earlier';
/** Group order, newest first. */
export declare const RECENCY_GROUPS: readonly RecencyGroup[];
/** Locale key of each recency group header. */
export declare const RECENCY_KEY: Record<RecencyGroup, TaskBoardKey>;
/**
 * Bucket an instant: the same Host calendar day as now, the last seven days, or
 * earlier.
 * @param at - the instant to bucket.
 * @param now - the current instant.
 * @param timeZone - Host IANA zone the calendar day is read in.
 */
export declare function recencyGroup(at: number, now: number, timeZone?: string): RecencyGroup;
/** One recency group and its items, newest first. */
export interface RecencyBucket<T> {
    group: RecencyGroup;
    items: T[];
}
/**
 * Sort items newest first and split them into recency groups; empty groups are
 * omitted.
 * @param items - the items to group.
 * @param at - the instant each item is ordered and bucketed by.
 * @param now - the current instant.
 * @param timeZone - Host IANA zone.
 */
export declare function groupByRecency<T>(items: readonly T[], at: (item: T) => number, now: number, timeZone?: string): RecencyBucket<T>[];
/** Columns that render compact by default: the long settled column. */
export declare const DEFAULT_COMPACT_COLUMNS: readonly TaskStatus[];
/** Browser storage key of the per-column density choice. */
export declare const COMPACT_COLUMNS_KEY = "dsh.taskBoard.compactColumns.v1";
/**
 * Read the columns the user set to compact. A missing, unreadable or malformed
 * value falls back to the default rather than failing the board.
 * @param storage - browser storage (absent outside a browser).
 */
export declare function readCompactColumns(storage: Pick<Storage, 'getItem'> | undefined): TaskStatus[];
/**
 * Persist the compact columns; a storage failure (quota, privacy mode) only
 * loses the preference.
 * @param storage - browser storage (absent outside a browser).
 * @param columns - the compact columns.
 */
export declare function writeCompactColumns(storage: Pick<Storage, 'setItem'> | undefined, columns: readonly TaskStatus[]): void;
