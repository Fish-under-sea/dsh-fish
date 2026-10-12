/**
 * Stable git error code → readable copy mapping (ZCode branchSwitcher
 * vocabulary). The host classifies failures onto the codes; this mapper owns
 * the user-facing sentences.
 * @module dsh-git-graph/client/chips/error-copy
 */
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots';
import type { GitError } from '../../core/types.ts';
import type { GitGraphKey } from '../locales.ts';
/**
 * One readable message for a git operation rejection.
 * @param error - the classified git error.
 * @param t - the git-graph namespace translate seat.
 * @returns the sentence for the error's code.
 */
export declare function errorMessage(error: GitError, t: Translate<GitGraphKey>): string;
//# sourceMappingURL=error-copy.d.ts.map