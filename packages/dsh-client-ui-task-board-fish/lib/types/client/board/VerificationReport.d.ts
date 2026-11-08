import { type ExecutionVerification } from '../../core/verification.ts';
/**
 * Render one execution's acceptance report.
 * @param props - the execution's persisted acceptance block.
 * @returns the verdict badge with its fold-out detail, or nothing when
 * acceptance never applied.
 */
export declare function VerificationReport({ verification }: {
    verification: ExecutionVerification;
}): import("react").JSX.Element | null;
