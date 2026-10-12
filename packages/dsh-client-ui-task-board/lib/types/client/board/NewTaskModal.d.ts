import type { BoardController } from '../../core/controller.ts';
import { type TaskRecord } from '../../core/tasks.ts';
import type { OverlayPhase } from './overlay.tsx';
export interface NewTaskModalProps {
    controller: BoardController;
    onClose: () => void;
    /** Optional task template to clone/duplicate from. */
    initialTask?: TaskRecord;
    /**
     * Workspace the board's project filter has selected (#1536): a task created
     * while a project is open belongs to that project unless the user changes it.
     */
    defaultWorkspaceId?: string;
    /** Optional callback after successful duplication (e.g. to archive source). */
    onDuplicateSuccess?: (sourceTaskId: string) => Promise<void>;
    /**
     * Task the new card becomes a subtask of ("add subtask" from its detail
     * view). The execution targets start from the parent's and the create action
     * carries the parent link; unset targets inherit again at run time.
     */
    parentTask?: TaskRecord;
    /** Which leg of the enter/exit motion pair the surface is on. */
    phase?: OverlayPhase;
}
/** New-task form overlay. */
export declare function NewTaskModal({ controller, onClose, initialTask, defaultWorkspaceId, onDuplicateSuccess, parentTask, phase }: NewTaskModalProps): import("react").JSX.Element;
