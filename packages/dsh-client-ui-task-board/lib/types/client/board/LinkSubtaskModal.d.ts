import type { BoardController } from '../../core/controller.ts';
import { type TaskRecord } from '../../core/tasks.ts';
import { type OverlayPhase } from './overlay.tsx';
/** Link-subtask overlay props. */
export interface LinkSubtaskModalProps {
    controller: BoardController;
    /** The task the picked card becomes a subtask of. */
    parent: TaskRecord;
    onClose: () => void;
    /** Which leg of the enter/exit motion pair the surface is on. */
    phase?: OverlayPhase;
}
/** Link-subtask overlay. */
export declare function LinkSubtaskModal({ controller, parent, onClose, phase }: LinkSubtaskModalProps): import("react").JSX.Element;
