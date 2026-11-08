/**
 * Run-launch admission width: the one bound on how many sessions this board
 * starts at the same time.
 *
 * One board action opens a whole subtree, and a team run hands every member of
 * it to the Lead at once, so without a bound the Host asks DSH for dozens of
 * sessions in a single tick. The repository's own measured guidance caps heavy
 * implementation subagents at three (docs/multi-agent-resources.md) and no
 * runtime mechanism enforced it; this setting is that mechanism.
 *
 * The bounds and the default live here rather than in either half, exactly like
 * the roster cadence: the settings card validates a draft against the same
 * range the Host clamps a hand-edited configuration to, and a programmatic
 * mount that names no width gets the default.
 *
 * @module dsh-task-board/core/launch-width
 */
/** Width used when neither the settings document nor the mount names one. */
export declare const DEFAULT_RUN_LAUNCH_WIDTH = 3;
/** Narrowest accepted width: one launch at a time. */
export declare const RUN_LAUNCH_WIDTH_MIN = 1;
/** Widest accepted width. */
export declare const RUN_LAUNCH_WIDTH_MAX = 16;
/**
 * Clamp a configured width into the supported range. A value the schema would
 * refuse (non-finite, below the floor, above the ceiling) still leaves the
 * board launching: an out-of-range setting never stalls a run.
 * @param width - configured width, or undefined for the default.
 * @returns the effective width.
 */
export declare function normalizeRunLaunchWidth(width: number | undefined): number;
