import type { TaskRecord } from '../core/tasks.ts';
import { type TaskBoardAction, type TaskBoardEventPayload, type TaskBoardParseDraft, type TaskBoardParseRequest, type TaskBoardSnapshot } from '../protocol.ts';
/**
 * Failure classes of the Host API, in the language the panel renders
 * (issue #1528). The Host is the only part that knows whether a task-board
 * route exists at all, so a raw fetch/parse error must never reach the user:
 * "Unexpected token 'o', \"not found\" is not valid JSON" is what a missing
 * Host half looks like today.
 */
export type HostApiFailure = 
/** The board's own routes are not registered and nothing explains why. */
'not-mounted'
/** Another live DSH process owns the ledger, so this instance registered no board routes (#1730). */
 | 'ledger-locked'
/** This row degraded during start for some other reason the family health route reports (#1730). */
 | 'degraded' | 'unauthorized' | 'forbidden' | 'locked' | 'rejected' | 'timeout' | 'unreachable' | 'unexpected';
/** Transport failure carrying a stable class next to its user-facing message. */
export declare class HostApiError extends Error {
    readonly failure: HostApiFailure;
    readonly status?: number | undefined;
    constructor(failure: HostApiFailure, message: string, status?: number | undefined);
}
/**
 * Name the real reason this board's routes are missing (issue #1730).
 *
 * The core webserver answers an unmounted route with a bare 404, which cannot
 * distinguish "this deployment never loaded the plugin" from "this row
 * degraded during start" — a second DSH process holding `ledger-v2.lock` is
 * the case that matters, because the panel's advice ("restart the service")
 * is then false: the lock belongs to the other process, and restarting cannot
 * win it. The family health route knows the difference, so the 404 is
 * disambiguated there before anything is shown.
 * @param fallback - copy for the plain "routes are not there" failure, which
 *   is route-specific (the board's state route and the AI-parse route phrase
 *   their own absence); it is also what is shown when the ledger names nothing.
 * @param fetchImpl - fetch implementation (injected for tests).
 * @returns the HostApiError to throw for a missing board route.
 */
export declare function missingRouteFailure(fallback?: string, fetchImpl?: typeof fetch): Promise<HostApiError>;
export interface TaskBoardHostTransport {
    bootstrap(legacy: readonly TaskRecord[]): Promise<TaskBoardSnapshot>;
    state(): Promise<TaskBoardSnapshot>;
    action(action: TaskBoardAction, initiator?: string): Promise<TaskBoardSnapshot>;
    subscribe(listener: (event?: TaskBoardEventPayload) => void): () => void;
    /** One-shot model parse of pasted text (issue #1540). */
    parseDraft(request: TaskBoardParseRequest, signal?: AbortSignal): Promise<TaskBoardParseDraft>;
}
export declare class HttpTaskBoardHostTransport implements TaskBoardHostTransport {
    private readonly storage;
    constructor(storage?: Pick<Storage, 'getItem' | 'setItem'> | undefined);
    bootstrap(legacy: readonly TaskRecord[]): Promise<TaskBoardSnapshot>;
    state(): Promise<TaskBoardSnapshot>;
    action(action: TaskBoardAction, initiator?: string): Promise<TaskBoardSnapshot>;
    private post;
    private request;
    /**
     * Ask the Host to turn pasted text into task fields. The route answers a
     * typed failure (no model, timeout, unparseable reply) already phrased for
     * the form, so the UI never renders a raw status code (issue #1540).
     */
    parseDraft(request: TaskBoardParseRequest, signal?: AbortSignal): Promise<TaskBoardParseDraft>;
    subscribe(listener: (event?: TaskBoardEventPayload) => void): () => void;
}
