import type { TaskStatus } from '../../core/tasks.ts'
import { verificationPhase, type ExecutionVerification, type VerificationPhase } from '../../core/verification.ts'
import type { TaskBoardKey } from '../locales.ts'

/** Task status → locale key (board column titles and the detail badge). */
export const STATUS_KEY: Record<TaskStatus, TaskBoardKey> = {
  backlog: 'board.status.backlog',
  todo: 'board.status.todo',
  running: 'board.status.running',
  done: 'board.status.done',
  failed: 'board.status.failed',
}

/**
 * Acceptance phase to the label the running column shows: executing,
 * verifying, or fixing a failed acceptance. The card keeps one running label;
 * this decides which one.
 */
export const VERIFICATION_PHASE_KEY: Record<VerificationPhase, TaskBoardKey> = {
  off: 'running.executing',
  executing: 'running.executing',
  verifying: 'running.verifying',
  repairing: 'running.repairing',
  passed: 'running.verificationPassed',
  failed: 'running.verificationFailed',
  // Held for a human: the judge produced no usable veto, so this is NOT the
  // quality-failure label.
  invalid: 'running.verificationInvalid',
}

/**
 * The acceptance label for one open execution, or undefined when acceptance
 * does not govern it (the switch was off at start, the run never became a goal
 * run, or a teammate is covered by its Lead).
 * @param verification - the execution's acceptance state.
 * @returns the locale key to render, or undefined for the historical label.
 */
export function verificationRunningKey(verification: ExecutionVerification | undefined): TaskBoardKey | undefined {
  if (verification === undefined || verification.applicability !== 'enforced') return undefined
  return VERIFICATION_PHASE_KEY[verificationPhase(verification)]
}
