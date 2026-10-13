/**
 * The worktree manager dialog: every linked worktree of the repository with
 * its branch/head, plus removal of managed worktrees. Dirty worktrees reject
 * once and surface an inline force-confirm; the wt/ branch survives removal
 * unless the row's delete-branch checkbox is on. The primary checkout row is
 * display-only.
 * @module dsh-git-graph/client/worktrees/WorktreeManager
 */
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots';
import type { WorktreeListView, WorktreeRemoveResult } from '../../core/types.ts';
import type { GitGraphKey } from '../locales.ts';
/** Props of the worktree manager dialog. */
export interface WorktreeManagerProps {
    /** Fetch the fresh worktree list. */
    fetchWorktrees: () => Promise<WorktreeListView | null>;
    /** Remove one managed worktree (force/deleteBranch options ride through). */
    onRemove: (worktreePath: string, opts: {
        force?: boolean;
        deleteBranch?: boolean;
    }) => Promise<WorktreeRemoveResult>;
    /** Close the dialog. */
    onClose: () => void;
    t: Translate<GitGraphKey>;
}
/**
 * The worktree manager dialog.
 * @param props - see {@link WorktreeManagerProps}.
 */
export declare function WorktreeManager({ fetchWorktrees, onRemove, onClose, t }: WorktreeManagerProps): import("react").JSX.Element;
//# sourceMappingURL=WorktreeManager.d.ts.map