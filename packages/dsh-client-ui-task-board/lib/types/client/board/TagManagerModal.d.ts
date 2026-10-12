import type { BoardController } from '../../core/controller.ts';
import { type TaskRecord } from '../../core/tasks.ts';
import { type OverlayPhase } from './overlay.tsx';
/** One label as the manager lists it: its definition plus how many tasks carry it. */
export interface TagUsage {
    name: string;
    promptPrefix?: string;
    /** Tasks carrying the label right now. */
    count: number;
}
/**
 * Labels in use, in board order (first occurrence wins, exactly like the
 * filter row), each with its usage count.
 * @param tasks - the whole ledger (board and archive).
 * @returns one row per label.
 */
export declare function tagUsage(tasks: readonly TaskRecord[]): TagUsage[];
/** Label-manager overlay props. */
export interface TagManagerModalProps {
    controller: BoardController;
    onClose: () => void;
    /** Which leg of the enter/exit motion pair the surface is on. */
    phase?: OverlayPhase;
}
/** Label-manager overlay. */
export declare function TagManagerModal({ controller, onClose, phase }: TagManagerModalProps): import("react").JSX.Element;
