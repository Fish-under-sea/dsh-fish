import type { TaskStatus } from '../../core/tasks.ts';
import { type ExecutionVerification, type VerificationPhase } from '../../core/verification.ts';
import type { TaskBoardKey } from '../locales.ts';
/** Task status → locale key (board column titles and the detail badge). */
export declare const STATUS_KEY: Record<TaskStatus, TaskBoardKey>;
/**
 * Acceptance phase to the label the running column shows: executing,
 * verifying, or fixing a failed acceptance. The card keeps one running label;
 * this decides which one.
 */
export declare const VERIFICATION_PHASE_KEY: Record<VerificationPhase, TaskBoardKey>;
/**
 * The acceptance label for one open execution, or undefined when acceptance
 * does not govern it (the switch was off at start, the run never became a goal
 * run, or a teammate is covered by its Lead).
 * @param verification - the execution's acceptance state.
 * @returns the locale key to render, or undefined for the historical label.
 */
export declare function verificationRunningKey(verification: ExecutionVerification | undefined): TaskBoardKey | undefined;
