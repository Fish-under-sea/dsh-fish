/**
 * The board's browser-half extension service (`taskBoard`).
 *
 * It gives a provider's browser half the client capability face from the
 * contract: dispatch over the board's same-origin action channel, card
 * visibility predicates, and a subscription to the board mirror. The board
 * controller is attached and detached as the master switch mounts and unmounts
 * the UI, so the service can be provided before any controller exists.
 *
 * @module dsh-task-board/client/service
 */
import type { BoardController } from '../core/controller.ts';
import type { TaskBoardClientFace, TaskBoardClientMirror, TaskBoardExtensionActionRequest, TaskBoardVisibilityPredicate } from '../core/extension.ts';
export declare class TaskBoardClientService implements TaskBoardClientFace {
    private controller;
    private enabled;
    private unsubscribeController;
    /** Predicates registered before the controller exists, replayed on attach. */
    private readonly pendingVisibility;
    private readonly listeners;
    /** Bind the live board controller (called when the UI mounts). */
    attach(controller: BoardController): void;
    /** Release the current controller (called when the UI unmounts). */
    detach(): void;
    /** Apply the board's master switch. */
    setEnabled(enabled: boolean): void;
    dispatch(request: TaskBoardExtensionActionRequest): Promise<boolean>;
    registerVisibility(predicate: TaskBoardVisibilityPredicate): () => void;
    subscribe(callback: (mirror: TaskBoardClientMirror) => void): () => void;
    snapshot(): TaskBoardClientMirror;
    private notify;
}
