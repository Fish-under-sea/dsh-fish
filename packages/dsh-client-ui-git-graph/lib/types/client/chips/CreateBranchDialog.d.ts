/**
 * The create-branch dialog: name input with the pure validation mirror for
 * instant feedback, the host `check-ref-format` gate as the authority, and
 * readable rejection copy.
 * @module dsh-git-graph/client/chips/CreateBranchDialog
 */
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots';
import type { SwitchResult } from '../../core/types.ts';
import type { GitGraphKey } from '../locales.ts';
/** Props of the create-branch dialog. */
export interface CreateBranchDialogProps {
    /** The host create verb (`git switch --no-guess -c <name>` from HEAD). */
    onCreate: (name: string) => Promise<SwitchResult>;
    /** Close the dialog (cancel or after a successful create). */
    onClose: () => void;
    t: Translate<GitGraphKey>;
}
/**
 * The create-and-switch dialog.
 * @param props - see {@link CreateBranchDialogProps}.
 */
export declare function CreateBranchDialog({ onCreate, onClose, t }: CreateBranchDialogProps): import("react").JSX.Element;
//# sourceMappingURL=CreateBranchDialog.d.ts.map