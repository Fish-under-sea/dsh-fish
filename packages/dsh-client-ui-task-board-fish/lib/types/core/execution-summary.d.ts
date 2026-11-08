/**
 * What one execution left behind: the text of its last assistant message,
 * recorded on the execution record next to the verdict it belongs to.
 *
 * A settled execution used to carry only a verdict, so a parent card could see
 * that a subtask succeeded without ever seeing what it produced, and had to
 * guess or redo the work. The card's own content cannot answer that: card
 * content is the plan and freezes at the first execution
 * (`canEditTaskContent`), so the closing words of a run are recorded on the
 * execution record instead.
 *
 * Pure (no cordis, no runtime imports) so the settlement path is unit-testable
 * without a session, and so a text-less run degrades to "no field" rather than
 * to an empty string.
 */
import { type ExecutionSummary } from './tasks.ts';
/** Structural view of one session event, as both readers expose it. */
export interface SummaryEvent {
    type?: unknown;
    seq?: unknown;
    time?: unknown;
    data?: unknown;
}
/**
 * Bound one summary, keeping its tail: the closing paragraphs carry the
 * conclusion a reader is after, and the omitted opening is announced instead of
 * silently dropped. Mirrors the evidence reader's tail bound.
 */
export declare function truncateExecutionSummary(text: string, limit?: number): string;
/**
 * The summary one execution's own events support.
 *
 * Only events at or after `startedAt` belong to this run: a reused session
 * carries the history of earlier executions, which must not be reported as this
 * one's output. The last assistant message WITH prose wins — a trailing
 * tool-call or reasoning-only message has nothing to leave behind, so the reader
 * walks back to the last one that speaks.
 * @param events - the session events the inspection already read.
 * @param startedAt - the execution's start instant (ms epoch); 0 means "all".
 * @returns the bounded summary with the seq it came from, or undefined when the
 * run left no usable text.
 */
export declare function executionSummaryOf(events: readonly SummaryEvent[], startedAt: number): ExecutionSummary | undefined;
/**
 * Repair one persisted or reported summary.
 *
 * A summary is informational, so an unreadable one is dropped on its own rather
 * than costing the execution (or the task row) it hangs on. A hand-edited
 * overlong text is bounded on the way in, so no reader ever holds more than the
 * limit.
 */
export declare function normalizeExecutionSummary(value: unknown): ExecutionSummary | undefined;
