/**
 * One execution's goal-acceptance report.
 *
 * Rendered inside the execution-history row, so a rerun or a scheduled run
 * keeps its OWN report and a later cycle never overwrites an earlier verdict.
 * It shows what the board decided and the evidence it decided on: the verdict,
 * the judge route and reasoning level, the acceptance count, the total and
 * per-criterion scores against their threshold, the findings the judge located,
 * the evidence scope with its truncation, and the token usage.
 *
 * Deliberately adds no new `data-dsh-part` value: the part enum is owned by the
 * cross-repository semantic-attribute contract, and this report reuses the
 * execution row's existing markup instead of extending that enum.
 */
import { type ExecutionVerification } from '../../core/verification.ts';
/**
 * Render one execution's acceptance report.
 * @param props - the execution's persisted acceptance block.
 * @returns the report, or nothing when acceptance never applied.
 */
export declare function VerificationReport({ verification }: {
    verification: ExecutionVerification;
}): import("react").JSX.Element | null;
