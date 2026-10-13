/**
 * Host-side extension registry: the one place that admits external providers,
 * negotiates the contract version, gates them on the board's own enable state,
 * fans board events out to them, and routes dispatched provider actions back.
 *
 * Failure policy (mirrors the board's plugin philosophy): a provider that
 * throws, mis-declares its version, or disables itself degrades only its own
 * surface. The board keeps serving; the registry records what it refused.
 *
 * @module dsh-task-board/host/extension-registry
 */
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import type { HostTaskLedger } from '../host-ledger.ts';
import type { TaskBoardAction, TaskBoardSnapshot } from '../protocol.ts';
import { type TaskBoardExecutionSettledEvent, type TaskBoardExtension, type TaskBoardExtensionActionRequest, type TaskBoardExtensionPayload, type TaskBoardStatusChangedEvent, type TaskBoardTaskDeletedEvent } from '../core/extension.ts';
/** Diagnosable refusal raised by the registry and the capability face. */
export declare class TaskBoardExtensionError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/** Logging seat the registry uses; a deployment may supply its own. */
export interface TaskBoardExtensionLogger {
    warn(message: string, ...rest: unknown[]): void;
    error(message: string, ...rest: unknown[]): void;
}
/** The deployment's model-visible tool registry, resolved lazily. */
export interface TaskBoardExtensionToolRegistry {
    register(definition: ToolDefinition): () => void;
}
/** Applies one board action with every board gate intact (never an extension action). */
export type TaskBoardActionApplier = (action: Exclude<TaskBoardAction, {
    kind: 'extension-action';
}>, initiator?: string) => TaskBoardSnapshot;
/** Registry dependencies. */
export interface TaskBoardExtensionRegistryOptions {
    ledger: HostTaskLedger;
    /** Apply an action through the board service (gates, run dispatch, schedule). */
    apply?: TaskBoardActionApplier;
    /** Resolve the deployment's tool registry; absent loses the tool surface only. */
    toolRegistry?: () => TaskBoardExtensionToolRegistry | undefined;
    now?: () => number;
    uuid?: () => string;
    logger?: TaskBoardExtensionLogger;
}
export declare class TaskBoardExtensionRegistry {
    private readonly entries;
    private readonly ledger;
    private readonly applyAction;
    private readonly now;
    private readonly uuid;
    private readonly logger;
    private toolResolver;
    /** Board master switch (enabled config); providers start only while it is on. */
    private boardEnabled;
    private disposed;
    constructor(options: TaskBoardExtensionRegistryOptions);
    /**
     * Pin (or replace) the deployment's tool registry. A registry that appears
     * after a provider started is picked up here, which is what keeps the tool
     * surface alive across the board's own late service resolution.
     */
    setToolRegistry(resolver: (() => TaskBoardExtensionToolRegistry | undefined) | undefined): void;
    /** Apply the board's master switch; providers start and stop with it. */
    setEnabled(enabled: boolean): void;
    /** Whether the board currently runs a given extension (board x extension). */
    isActive(extensionId: string): boolean;
    /**
     * Admit one provider. Idempotent by id: a second registration of the same id
     * is a no-op that returns the same release handle. A contract-version
     * mismatch is refused visibly (logged and thrown) without disturbing the
     * board or any other provider.
     * @param extension - the provider to admit.
     * @returns a disposer releasing the registration (idempotent).
     */
    registerExtension(extension: TaskBoardExtension): () => void;
    /** Remove one provider; its provider-side work stops and its payload stays stored. */
    unregister(extensionId: string): void;
    /**
     * Route one dispatched provider action. Refuses visibly when the extension is
     * unknown, currently gated off, or does not implement the action.
     */
    handleAction(request: TaskBoardExtensionActionRequest): Promise<unknown>;
    /** Published summaries of currently running providers, keyed by extension id. */
    published(): Record<string, TaskBoardExtensionPayload>;
    /** Fan a status change out to every running provider, isolated per callback. */
    emitStatusChanged(event: TaskBoardStatusChangedEvent): void;
    /** Fan an execution settlement out to every running provider. */
    emitExecutionSettled(event: TaskBoardExecutionSettledEvent): void;
    /** Fan a task deletion out to every running provider. */
    emitTaskDeleted(event: TaskBoardTaskDeletedEvent): void;
    /** Stop every provider and release the registry (idempotent). */
    dispose(): void;
    private emit;
    /** Start or stop one entry against the current board + extension gate. */
    private reconcile;
    private startEntry;
    private stopEntry;
    /** (Re)register every buffered tool against the current tool registry. */
    private syncTools;
    private disposeTools;
    private assertActive;
    /** Build the per-extension capability face. */
    private capabilities;
    private createTask;
    private patchContent;
    private setStatus;
    private linkedTasks;
    private writeIntegration;
    private publish;
    private registerTool;
}
