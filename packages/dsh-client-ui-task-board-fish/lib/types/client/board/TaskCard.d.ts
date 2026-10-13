import type { TaskRecord } from '../../core/tasks.ts';
/** Compact relative/absolute time label. */
export declare function formatHostTimestamp(ms: number, timeZone?: string): string;
export declare function formatTime(ms: number, timeZone?: string): string;
/**
 * Card time label: relative within a day, otherwise the calendar date read in
 * the Host time zone (the same zone the tooltip and the detail view use), so a
 * card never shows a browser-local date beside a Host-zone tooltip.
 * @param ms - the instant.
 * @param timeZone - Host IANA zone; absent uses the browser zone.
 * @param now - the current instant.
 */
export declare function formatCardTime(ms: number, timeZone?: string, now?: number): string;
declare function TaskCardInner({ task, pending, timeZone, onClick, onOpenSession, compact, subtaskCount, isSubtask, subtasksDone, subtasksRunning, subtasksFailed, }: {
    task: TaskRecord;
    pending: boolean;
    timeZone?: string;
    onClick: () => void;
    /** Open an execution session; absent renders the session mark inert. */
    onOpenSession?: (sessionId: string) => void;
    /** Single-line density used by long settled columns. */
    compact?: boolean;
    /** Direct subtasks of this card, shown as a badge (0 hides it). */
    subtaskCount?: number;
    /** Whether this card is itself a subtask. */
    isSubtask?: boolean;
    /** Direct subtasks already settled as done, for the roll-up badge. */
    subtasksDone?: number;
    /** Direct subtasks currently running, for the roll-up badge. */
    subtasksRunning?: number;
    /** Direct subtasks that failed, for the roll-up badge. */
    subtasksFailed?: number;
}): import("react").JSX.Element;
/** Memoized card: re-renders only when the card's own task record changes. */
export declare const TaskCard: import("react").MemoExoticComponent<typeof TaskCardInner>;
export {};
