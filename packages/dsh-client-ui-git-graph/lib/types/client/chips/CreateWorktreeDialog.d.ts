/**
 * The create-worktree dialog: name input with the sanitizer mirror for
 * instant feedback, a base-branch picker (default: the checkout's current
 * branch), and readable rejection copy. Success registers the worktree as a
 * workspace and starts a new session in it (the owner owns that flow).
 * @module dsh-git-graph/client/chips/CreateWorktreeDialog
 */
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots';
import type { BranchRow, WorktreeAddResult } from '../../core/types.ts';
import type { GitGraphKey } from '../locales.ts';
/** Props of the create-worktree dialog. */
export interface CreateWorktreeDialogProps {
    /** Local branches for the base picker. */
    branches: BranchRow[];
    /** The checkout's current branch (the picker default); empty when detached. */
    currentBranch: string;
    /** The create flow: host worktree-add, then workspace registration + session start. */
    onCreate: (name: string, baseRef: string | undefined) => Promise<WorktreeAddResult>;
    /** Close the dialog (cancel or after a successful create). */
    onClose: () => void;
    t: Translate<GitGraphKey>;
}
/**
 * The create-worktree-and-start-session dialog.
 * @param props - see {@link CreateWorktreeDialogProps}.
 */
export declare function CreateWorktreeDialog({ branches, currentBranch, onCreate, onClose, t }: CreateWorktreeDialogProps): import("react").JSX.Element;
//# sourceMappingURL=CreateWorktreeDialog.d.ts.map