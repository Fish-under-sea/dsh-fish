/**
 * The branch picker popover: searchable local branch list with the current
 * branch checked, the dirtiness line, switch feedback (success/error), and
 * the footer flows (create branch / Git graph).
 * @module dsh-git-graph/client/chips/BranchPopover
 */
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots';
import type { BranchesView, SwitchResult } from '../../core/types.ts';
import type { GitGraphKey } from '../locales.ts';
/** Props of the branch picker popover. */
export interface BranchPopoverProps {
    view: BranchesView;
    /** Workspace-level switch verb; resolves to a stable git error on rejection. */
    onSwitch: (branch: string) => Promise<SwitchResult>;
    /** Fired after a successful switch (the owner refetches its status). */
    onSwitched: () => void;
    /** Open the create-branch dialog. */
    onCreate: () => void;
    /** Open the Git graph panel. */
    onGraph: () => void;
    /** Open the create-worktree (new isolated session) dialog. */
    onCreateWorktree: () => void;
    /** Open the worktree manager. */
    onManageWorktrees: () => void;
    /** Close the popover (backdrop / after a successful switch). */
    onClose: () => void;
    t: Translate<GitGraphKey>;
    /** Open downward from the official hero row (the default opens upward from the dock row). */
    hero?: boolean;
}
/**
 * The branch picker popover.
 * @param props - see {@link BranchPopoverProps}.
 */
export declare function BranchPopover({ view, onSwitch, onSwitched, onCreate, onGraph, onCreateWorktree, onManageWorktrees, onClose, t, hero }: BranchPopoverProps): import("react").JSX.Element;
//# sourceMappingURL=BranchPopover.d.ts.map