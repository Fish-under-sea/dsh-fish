import type { BoardController } from '../../core/controller.ts';
import { type TaskRecord } from '../../core/tasks.ts';
import type { OverlayPhase } from './overlay.tsx';
/** Edit-task form overlay. */
export declare function EditTaskModal({ controller, task, onClose, phase }: {
    controller: BoardController;
    task: TaskRecord;
    onClose: () => void;
    phase?: OverlayPhase;
}): import("react").JSX.Element;
/** Edit-tags modal: edit labels only, shown for tasks after first execution. */
export declare function EditTagsModal({ controller, task, onClose, phase }: {
    controller: BoardController;
    task: TaskRecord;
    onClose: () => void;
    phase?: OverlayPhase;
}): import("react").JSX.Element;
