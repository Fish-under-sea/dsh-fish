/**
 * Goal acceptance time budgets: the one place the judge's per-call ceiling and
 * the acceptance's total ceiling live.
 *
 * Both are user settings (seconds), so the bounds and the seconds to
 * milliseconds conversion live here rather than in either half: the Host
 * clamps a hand-edited profile value to the same range the schema declares, and
 * the gate reads the effective values live, so raising a ceiling takes effect
 * without a reload.
 *
 * The two numbers are one budget, not two independent knobs: one acceptance is
 * {@link ACCEPTANCE_JUDGE_CALLS} serial judge calls (three criteria times two
 * rounds), so a total budget that cannot fit the calls can only end the
 * acceptance early. {@link DEFAULT_VERIFICATION_BUDGET_SECONDS} is therefore
 * derived from the per-call default times the call count plus two retries.
 *
 * @module dsh-task-board/core/verification-budget
 */
import { CODING_CRITERIA, VERIFICATION_ROUNDS } from './verification.ts'

/** Judge calls one acceptance issues: every criterion, every round. */
export const ACCEPTANCE_JUDGE_CALLS: number = CODING_CRITERIA.length * VERIFICATION_ROUNDS

/**
 * Per-judge-call ceiling used when the row names none: two and a half minutes
 * for a reasoning model reading an 80,000 character trace with a 16,384 token
 * output cap. The former 120s constant was tight enough that a slow but healthy
 * route produced a wall of per-call timeouts, and every one of them was charged
 * as an acceptance anomaly against a budget that then failed the card.
 */
export const DEFAULT_VERIFICATION_CALL_TIMEOUT_SECONDS = 150

/** Shortest accepted per-call ceiling: below this no useful judge answers. */
export const VERIFICATION_CALL_TIMEOUT_MIN_SECONDS = 30

/** Longest accepted per-call ceiling, ten minutes. */
export const VERIFICATION_CALL_TIMEOUT_MAX_SECONDS = 600

/** Headroom the default total budget leaves beyond the mandatory calls. */
const DEFAULT_BUDGET_EXTRA_CALLS = 2

/**
 * Total ceiling of one acceptance attempt, covering evidence rendering and
 * every judge call including retries. Derived from the per-call default rather
 * than pinned, because a total budget smaller than
 * {@link ACCEPTANCE_JUDGE_CALLS} times the per-call ceiling guarantees that no
 * acceptance can ever finish.
 */
export const DEFAULT_VERIFICATION_BUDGET_SECONDS: number =
  DEFAULT_VERIFICATION_CALL_TIMEOUT_SECONDS * (ACCEPTANCE_JUDGE_CALLS + DEFAULT_BUDGET_EXTRA_CALLS)

/** Shortest accepted total budget: long enough for at least one judge call. */
export const VERIFICATION_BUDGET_MIN_SECONDS = 120

/** Longest accepted total budget, thirty minutes. */
export const VERIFICATION_BUDGET_MAX_SECONDS = 1800

/** The default total budget in milliseconds, the face the abort timer takes. */
export const DEFAULT_VERIFICATION_BUDGET_MS = DEFAULT_VERIFICATION_BUDGET_SECONDS * 1_000

/**
 * Clamp a configured ceiling into the supported range. A value the schema
 * would refuse (non-finite, below the floor, above the ceiling) still leaves
 * the board judging: an out-of-range setting never disables acceptance.
 * @param value - configured seconds, or undefined for the default.
 * @param fallback - the default to use when nothing usable was configured.
 * @param min - shortest accepted value.
 * @param max - longest accepted value.
 * @returns the effective value in seconds.
 */
function clampSeconds(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.trunc(value), min), max)
}

/**
 * The effective per-judge-call ceiling.
 * @param seconds - configured seconds, or undefined for the default.
 * @returns the effective ceiling in seconds.
 */
export function normalizeVerificationCallTimeoutSeconds(seconds: number | undefined): number {
  return clampSeconds(
    seconds,
    DEFAULT_VERIFICATION_CALL_TIMEOUT_SECONDS,
    VERIFICATION_CALL_TIMEOUT_MIN_SECONDS,
    VERIFICATION_CALL_TIMEOUT_MAX_SECONDS,
  )
}

/**
 * The effective per-judge-call ceiling the timer face takes.
 * @param seconds - configured seconds, or undefined for the default.
 * @returns the effective ceiling in milliseconds.
 */
export function verificationCallTimeoutMs(seconds: number | undefined): number {
  return normalizeVerificationCallTimeoutSeconds(seconds) * 1_000
}

/**
 * The effective total budget of one acceptance attempt.
 * @param seconds - configured seconds, or undefined for the default.
 * @returns the effective budget in seconds.
 */
export function normalizeVerificationBudgetSeconds(seconds: number | undefined): number {
  return clampSeconds(seconds, DEFAULT_VERIFICATION_BUDGET_SECONDS, VERIFICATION_BUDGET_MIN_SECONDS, VERIFICATION_BUDGET_MAX_SECONDS)
}

/**
 * The effective total budget the abort face takes.
 * @param seconds - configured seconds, or undefined for the default.
 * @returns the effective budget in milliseconds.
 */
export function verificationBudgetMs(seconds: number | undefined): number {
  return normalizeVerificationBudgetSeconds(seconds) * 1_000
}
