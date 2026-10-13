/**
 * The Git graph panel: a read-only commit list with lane topology, ref
 * labels, and paging (git log --branches --tags --remotes --topo-order).
 * @module dsh-git-graph/client/graph/GraphDialog
 */
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots';
import type { GraphView } from '../../core/types.ts';
import type { GitGraphKey } from '../locales.ts';
/** Props of the Git graph dialog. */
export interface GraphDialogProps {
    /** The graph verb (host-side read-only log). */
    graph: (limit?: number) => Promise<GraphView | null>;
    onClose: () => void;
    t: Translate<GitGraphKey>;
}
/**
 * The Git graph panel.
 * @param props - see {@link GraphDialogProps}.
 */
export declare function GraphDialog({ graph, onClose, t }: GraphDialogProps): import("react").JSX.Element;
//# sourceMappingURL=GraphDialog.d.ts.map