/**
 * One-shot model parse behind the board's "parse pasted text" action
 * (issue #1540).
 *
 * The browser half never talks to a model: it posts the pasted text and the
 * route the user picked to the Host, which calls the injected `llm` service
 * once and answers with the three draft fields the new-task form accepts. The
 * reply is untrusted text, so extraction is defensive: code fences are
 * stripped, the first JSON object wins, and an unusable reply falls back to
 * the user's own words instead of an empty form.
 */
import { type LlmRuntime } from '@deepseek-ai/dsh-llm';
import type { TaskBoardParseDraft, TaskBoardParseRequest } from './protocol.ts';
/** How long one parse may take before the Host gives up on the model. */
export declare const TASK_PARSE_TIMEOUT_MS = 45000;
/** Largest pasted text one parse accepts (bytes). */
export declare const TASK_PARSE_MAX_INPUT: number;
export type TaskParseFailureCode = 'no-model' | 'model-error' | 'parse-failed' | 'timeout';
/** Typed parse failure; the route maps the code onto a status and a body. */
export declare class TaskParseError extends Error {
    readonly code: TaskParseFailureCode;
    constructor(code: TaskParseFailureCode, message: string);
}
/** Split a qualified `provider/model` route the same way the runner does. */
export declare function splitModelRoute(qualified: string | undefined): {
    provider: string;
    model: string;
} | undefined;
/**
 * Read the draft out of a model reply. Fences and surrounding prose are
 * tolerated; anything unusable returns undefined so the caller can decide
 * between a typed failure and a fallback.
 * @param reply - raw model text.
 */
export declare function extractTaskParseReply(reply: string): Partial<TaskBoardParseDraft> | undefined;
/**
 * Fill the three form fields, falling back to the pasted text so a weak model
 * reply never loses what the user actually wrote.
 * @param reply - raw model text.
 * @param source - the text the user pasted.
 */
export declare function draftFromReply(reply: string, source: string): TaskBoardParseDraft;
/**
 * Parse one pasted text through the injected `llm` service.
 * @param llm - the Host's llm service.
 * @param request - pasted text plus the qualified model route.
 * @param signal - caller cancellation (client disconnect); combined with the timeout.
 * @returns the draft fields.
 * @throws TaskParseError with a code the route maps onto a status.
 */
export declare function parseTaskDraft(llm: LlmRuntime, request: TaskBoardParseRequest, signal?: AbortSignal): Promise<TaskBoardParseDraft>;
