import type { BoardController } from '../../core/controller.ts';
import { type TaskRecord } from '../../core/tasks.ts';
import { type OverlayPhase } from './overlay.tsx';
/** Task detail overlay. */
export declare function TaskDetail({ controller, task, phase }: {
    controller: BoardController;
    task: TaskRecord;
    phase?: OverlayPhase;
}): import("react").JSX.Element;
