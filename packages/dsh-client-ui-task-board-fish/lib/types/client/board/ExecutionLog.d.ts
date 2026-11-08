import type { ExecutionRecord } from '../../core/tasks.ts';
import { type TaskBoardKey } from '../locales.ts';
/** Rows shown before the history asks to be expanded. */
export declare const VISIBLE_EXECUTIONS = 5;
/** Execution outcome → locale key, shared with the history's folded summary. */
/**
 * A recorded failure text in the reader's own language, for the refusals the
 * board itself produces and can therefore translate. Any other text is the
 * Host's own sentence and is printed verbatim.
 * @param error - the execution's recorded failure text.
 * @returns the localized refusal, or the original text.
 */
export declare function failureText(error: string): string;
export declare const EXECUTION_RESULT_KEY: Record<NonNullable<ExecutionRecord['result']>, TaskBoardKey>;
/**
 * Render one card's execution history.
 * @param props - the card's executions, its time zone and the session jump.
 * @returns the newest rows, the disclosure for the rest, and nothing else.
 */
export declare function ExecutionLog({ executions, timeZone, onOpenSession }: {
    executions: readonly ExecutionRecord[];
    timeZone?: string;
    onOpenSession: (sessionId: string) => void;
}): import("react").JSX.Element;
