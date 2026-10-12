/**
 * Roster-poll cadence: the one recurring Host timer the board holds.
 *
 * The cadence is a user setting (seconds), so the bounds and the seconds to
 * milliseconds conversion live here rather than in either half: the settings
 * card validates a draft against the same range the Host clamps a hand-edited
 * configuration to, and a programmatic mount that passes no cadence gets the
 * default.
 *
 * @module dsh-task-board/core/poll-cadence
 */
/** Cadence used when neither the settings document nor the mount names one. */
export declare const DEFAULT_SESSION_POLL_SECONDS = 5;
/** Shortest accepted cadence: a faster poll only burns CPU on the Host. */
export declare const SESSION_POLL_MIN_SECONDS = 1;
/** Longest accepted cadence, five minutes. */
export declare const SESSION_POLL_MAX_SECONDS = 300;
/**
 * Clamp a configured cadence into the supported range. A value the schema
 * would refuse (non-finite, below the floor, above the ceiling) still leaves
 * the board polling: an out-of-range setting never disables the timer.
 * @param seconds - configured cadence in seconds, or undefined for the default.
 * @returns the effective cadence in seconds.
 */
export declare function normalizeSessionPollSeconds(seconds: number | undefined): number;
/**
 * The cadence in the milliseconds the Host timer face takes.
 * @param seconds - configured cadence in seconds, or undefined for the default.
 * @returns the effective cadence in milliseconds.
 */
export declare function sessionPollMs(seconds: number | undefined): number;
