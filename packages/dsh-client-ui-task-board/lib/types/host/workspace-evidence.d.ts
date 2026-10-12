/** The subset of the host change service this module drives. */
export interface WorkspaceChangeSource {
    summary(sessionId: string, seq: number): unknown;
    diff(sessionId: string, seq: number, index: number, signal: AbortSignal): Promise<unknown>;
}
/** One session event, as the host log carries it. */
interface RawEvent {
    type?: unknown;
    seq?: unknown;
}
/** How many changed files one evidence block renders. */
export declare const MAX_WORKSPACE_FILES = 8;
/** Character ceiling for the whole rendered block. */
export declare const WORKSPACE_EVIDENCE_MAX_CHARS = 24000;
/** Character ceiling for one file's rendered comparison. */
export declare const WORKSPACE_EVIDENCE_MAX_FILE_CHARS = 6000;
/**
 * Resolve the optional host change service from a context-like object.
 * @param ctx - anything exposing @@get(name)@@.
 * @returns the service, or undefined when this deployment serves none.
 */
export declare function probeWorkspaceChanges(ctx: {
    get(name: string): unknown;
}): WorkspaceChangeSource | undefined;
/** The sequence of the newest change event inside the reviewed window. */
export declare function latestChangeEvent(events: readonly RawEvent[]): {
    seq: number;
    turn?: number;
} | undefined;
/**
 * Render the host's own record of what the reviewed window changed.
 *
 * Bounded twice — at most {@link MAX_WORKSPACE_FILES} files, and a shared
 * character budget split across them — so one enormous generated file cannot
 * crowd out every other change. Every failure degrades to less evidence (or an
 * empty block) instead of an error, because the acceptance being prepared must
 * still reach a verdict.
 * @param events - session events already bounded to the execution's window.
 * @param sessionId - the session whose changes these are.
 * @param source - the probed host service.
 * @param options - budget, cancellation and the diagnostic sink.
 * @returns the rendered block plus how many files it shows.
 */
export declare function renderWorkspaceEvidence(events: readonly RawEvent[], sessionId: string, source: WorkspaceChangeSource, options: {
    signal: AbortSignal;
    warn?: (message: string) => void;
    maxChars?: number;
}): Promise<{
    text: string;
    files: number;
    hash: string;
}>;
export {};
