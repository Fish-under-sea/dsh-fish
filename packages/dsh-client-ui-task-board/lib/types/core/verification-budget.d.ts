/** Judge calls one acceptance issues: every criterion, every round. */
export declare const ACCEPTANCE_JUDGE_CALLS: number;
/**
 * Per-judge-call ceiling used when the row names none: two and a half minutes
 * for a reasoning model reading an 80,000 character trace with a 16,384 token
 * output cap. The former 120s constant was tight enough that a slow but healthy
 * route produced a wall of per-call timeouts, and every one of them was charged
 * as an acceptance anomaly against a budget that then failed the card.
 */
export declare const DEFAULT_VERIFICATION_CALL_TIMEOUT_SECONDS = 150;
/** Shortest accepted per-call ceiling: below this no useful judge answers. */
export declare const VERIFICATION_CALL_TIMEOUT_MIN_SECONDS = 30;
/** Longest accepted per-call ceiling, ten minutes. */
export declare const VERIFICATION_CALL_TIMEOUT_MAX_SECONDS = 600;
/**
 * Total ceiling of one acceptance attempt, covering evidence rendering and
 * every judge call including retries. Derived from the per-call default rather
 * than pinned, because a total budget smaller than
 * {@link ACCEPTANCE_JUDGE_CALLS} times the per-call ceiling guarantees that no
 * acceptance can ever finish.
 */
export declare const DEFAULT_VERIFICATION_BUDGET_SECONDS: number;
/** Shortest accepted total budget: long enough for at least one judge call. */
export declare const VERIFICATION_BUDGET_MIN_SECONDS = 120;
/** Longest accepted total budget, thirty minutes. */
export declare const VERIFICATION_BUDGET_MAX_SECONDS = 1800;
/** The default total budget in milliseconds, the face the abort timer takes. */
export declare const DEFAULT_VERIFICATION_BUDGET_MS: number;
/**
 * The effective per-judge-call ceiling.
 * @param seconds - configured seconds, or undefined for the default.
 * @returns the effective ceiling in seconds.
 */
export declare function normalizeVerificationCallTimeoutSeconds(seconds: number | undefined): number;
/**
 * The effective per-judge-call ceiling the timer face takes.
 * @param seconds - configured seconds, or undefined for the default.
 * @returns the effective ceiling in milliseconds.
 */
export declare function verificationCallTimeoutMs(seconds: number | undefined): number;
/**
 * The effective total budget of one acceptance attempt.
 * @param seconds - configured seconds, or undefined for the default.
 * @returns the effective budget in seconds.
 */
export declare function normalizeVerificationBudgetSeconds(seconds: number | undefined): number;
/**
 * The effective total budget the abort face takes.
 * @param seconds - configured seconds, or undefined for the default.
 * @returns the effective budget in milliseconds.
 */
export declare function verificationBudgetMs(seconds: number | undefined): number;
