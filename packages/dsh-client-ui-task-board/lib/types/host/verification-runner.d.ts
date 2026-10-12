/**
 * Goal acceptance runner: evidence assembly and the judge calls of one
 * acceptance attempt.
 *
 * Lives in the host half because it needs the live session event log and the
 * official `llm` service; every rule it applies (criteria, scale, tags,
 * thresholds, budgets, caps) comes from `../core/verification.ts`, which mirrors
 * the installed dsh-llm-verifier 0.8.4 default final acceptance.
 */
import { type LlmRuntime } from '@deepseek-ai/dsh-llm';
import { type VerificationAttempt, type VerificationRoute, type VerificationUsage } from '../core/verification.ts';
/** Largest trace handed to the judge, mirroring the verifier's default cap. */
export declare const VERIFICATION_MAX_TRACE_CHARS = 80000;
/** Largest single trace entry; one huge tool result must not eat the budget. */
export declare const VERIFICATION_MAX_ENTRY_CHARS = 4000;
/** Largest per-finding text kept from one judge answer. */
export declare const VERIFICATION_MAX_FINDING_CHARS = 400;
/** Largest verbatim citation kept from one finding. */
export declare const VERIFICATION_MAX_QUOTE_CHARS = 600;
/** Largest requirement/observation/gap statement kept from one finding. */
export declare const VERIFICATION_MAX_PROBLEM_CHARS = 400;
/** Structured findings kept per judge answer and per acceptance. */
export declare const VERIFICATION_MAX_FINDINGS_PER_CALL = 3;
export declare const VERIFICATION_MAX_FINDINGS = 12;
/**
 * Default ceiling of ONE judge request. The effective ceiling is a row setting
 * (`goalVerificationCallTimeoutSeconds`), read live by the gate, because 120s was
 * tight for a reasoning model reading an 80,000 character trace with a 16,384
 * token output cap: every timeout it produced was charged as an acceptance
 * anomaly against a budget that then failed the card.
 */
export declare const VERIFICATION_CALL_TIMEOUT_MS = 150000;
export declare const VERIFICATION_MAX_TOKENS = 16384;
export declare const VERIFICATION_TEMPERATURE = 0.2;
export declare const VERIFICATION_REQUEST_ATTEMPTS = 3;
/** Redaction patterns, mirrored from the verifier's defaults. */
export declare const VERIFICATION_REDACT_PATTERNS: readonly string[];
/** Why one acceptance could not produce a verdict. */
export type VerificationErrorKind = 'route-unavailable' | 'timeout' | 'auth' | 'parse' | 'request' | 'aborted' | 'budget';
/**
 * The time one acceptance attempt may still spend.
 *
 * `deadline` is the instant the whole attempt runs out; `callTimeoutMs` is the
 * ceiling of a single judge call. The pair is what ties the retry budget to the
 * acceptance budget: a call is not started unless its own ceiling still fits
 * inside what is left, because starting one the outer budget will abort anyway
 * only burns wall time and turns a slow machine into an anomaly.
 */
export interface AcceptanceBudget {
    /** Absolute instant (ms epoch) the acceptance attempt runs out at. */
    deadline: number;
    /** Ceiling of one judge call in milliseconds. */
    callTimeoutMs: number;
    /** Clock the caller runs on, injected so tests drive it deterministically. */
    now: () => number;
}
/** An acceptance anomaly: never a quality verdict, always recorded as one. */
export declare class VerificationError extends Error {
    readonly kind: VerificationErrorKind;
    readonly usage: VerificationUsage;
    constructor(kind: VerificationErrorKind, message: string, usage?: VerificationUsage, options?: {
        cause?: unknown;
    });
}
/** Fresh zeroed usage counters. */
export declare function emptyUsage(): VerificationUsage;
/** Structural view of one session event, as the host log carries it. */
interface RawEvent {
    type?: unknown;
    seq?: unknown;
    time?: unknown;
    data?: unknown;
}
/** Read one session's events across the shapes the SDK cohort exposes. */
export declare function sessionEvents(session: unknown): readonly RawEvent[];
/** Evidence assembled for one acceptance attempt. */
export interface AcceptanceEvidence {
    problem: string;
    trace: string;
    entries: number;
    fromSeq?: number;
    toSeq?: number;
    omittedCharacters: number;
    hash: string;
}
/**
 * Assemble the evidence one acceptance judges.
 *
 * The window starts at the execution's own `startedAt`, never at the session's
 * first event: a reused session carries the history of earlier executions, and
 * those runs must not be judged as this one's work. Only observed output is
 * rendered — tool calls with their arguments and their results, assistant
 * prose, goal round markers and team messages — and the result is redacted and
 * capped before it ever reaches a judge.
 * @param session - the live session of the execution.
 * @param problem - the execution's composed prompt, shown as the task statement.
 * @param startedAt - the instant the execution opened (ms epoch).
 * @returns the bounded, redacted evidence.
 */
/**
 * The session events inside one execution's own window.
 *
 * A reused session carries the history of earlier executions; only the events
 * at or after this execution's start belong to the work being judged.
 * @param session - the live session.
 * @param startedAt - the execution's start instant (ms epoch).
 * @returns the events of this execution, oldest first.
 */
export declare function evidenceEvents(session: unknown, startedAt: number): readonly RawEvent[];
export declare function collectEvidence(session: unknown, problem: string, startedAt: number): AcceptanceEvidence;
/** The verdict of one acceptance attempt. */
export interface AcceptanceResult {
    attempt: VerificationAttempt;
}
/**
 * Run one acceptance: every criterion is judged twice, the odd round with the
 * A/B slots swapped, and the per-round scores are mapped back and averaged per
 * criterion.
 * @param input - the judge route, evidence, threshold, time budget and cancellation.
 * @returns the recorded attempt (quality verdict, anomaly, or budget stop).
 */
export declare function runAcceptance(input: {
    llm: LlmRuntime;
    route: VerificationRoute;
    evidence: AcceptanceEvidence;
    threshold: number;
    index: number;
    signal: AbortSignal;
    /** Instant (ms epoch) the attempt runs out at; defaults to now plus the default budget. */
    deadline?: number;
    /** Ceiling of one judge call; defaults to {@link VERIFICATION_CALL_TIMEOUT_MS}. */
    callTimeoutMs?: number;
    /** Host-observed workspace changes, rendered as the prompt's reference context. */
    context?: string;
    /** How many changed files that context shows. */
    workspaceFiles?: number;
    now?: () => number;
}): Promise<AcceptanceResult>;
export {};
