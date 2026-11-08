import type { TaskUpdatePatch } from './core/use-cases/task-update.ts';
import type { SetSchedulePatch } from './core/use-cases/task-schedule.ts';
import { type NewTaskInput, type TaskPermission, type TaskRecord, type TaskStatus } from './core/tasks.ts';
import { type TaskBoardExtensionPayload } from './core/extension.ts';
import { type ModelCatalogView, type VerificationContract, type VerificationSettings } from './core/verification.ts';
export declare const TASK_BOARD_SCHEMA_VERSION: 7;
/** Ledger documents written before v7; loaded once and migrated on startup. */
export declare const TASK_BOARD_LEGACY_SCHEMA_VERSION: 6;
/** Ledger documents written before v6 (the scheduling mode and run budget). */
export declare const TASK_BOARD_PRE_RUN_BUDGET_SCHEMA_VERSION: 5;
/** Ledger documents written before v5; migrated through the v5 normalization too. */
export declare const TASK_BOARD_PRE_ACCEPTANCE_SCHEMA_VERSION: 4;
/** Ledger documents written before v4; migrated through the v4 normalization too. */
export declare const TASK_BOARD_OLDER_SCHEMA_VERSION: 3;
/** Ledger documents written before v3; migrated through every later normalization too. */
export declare const TASK_BOARD_OLDEST_SCHEMA_VERSION: 2;
/**
 * The last generation whose rules still need the Host zone stamped on them at
 * migration: v4 introduced the stored zone but a rule written without one must
 * stop following a later TZ change. A v5 rule already carries its zone (or
 * deliberately follows the Host), so it is NOT stamped again.
 */
export declare const TASK_BOARD_ZONE_STAMP_SCHEMA_VERSION: 4;
/**
 * Every older generation the loader migrates in place. v5 only added the
 * per-execution acceptance block, v6 only added the scheduling mode and run
 * budget, and v7 only added the card attachment metadata, so the migration is
 * the normalization pass that re-validates each row; a document from any
 * listed generation upgrades losslessly.
 */
export declare const TASK_BOARD_MIGRATABLE_SCHEMA_VERSIONS: readonly number[];
export declare const TASK_BOARD_API_PREFIX = "/api/task-board";
/** Longest accepted caller identity on an external outcome record. */
export declare const EXTERNAL_INITIATOR_MAX_LENGTH = 200;
/** Longest accepted free-text summary on an external outcome record. */
export declare const EXTERNAL_SUMMARY_MAX_LENGTH = 1000;
export type PowerPhase = 'disabled' | 'idle' | 'acquiring' | 'active' | 'error' | 'unsupported';
export interface TaskBoardPowerSnapshot {
    platform: string;
    phase: PowerPhase;
    enabled: boolean;
    runningSessions: number;
    armedSchedules: number;
    sessionStateKnown: boolean;
    lastError?: string;
}
export interface TaskBoardSchedulerSnapshot {
    timeZone: string;
    /** Opaque identity of the current Host ledger generation. */
    ledgerId?: string;
    lastTickAt?: number;
    error?: string;
}
export interface TaskBoardSnapshot {
    schemaVersion: typeof TASK_BOARD_SCHEMA_VERSION;
    revision: number;
    tasks: TaskRecord[];
    scheduler: TaskBoardSchedulerSnapshot;
    power: TaskBoardPowerSnapshot;
    /** Session-default permission the confirmation gate compares against. */
    sessionDefaultPermission?: TaskPermission;
    /**
     * Deployment subtask depth limit (1..3). The browser mirrors it to enable or
     * disable the subtask controls; the Host ledger is the authority.
     */
    maxSubtaskDepth?: number;
    /**
     * Live GLOBAL native-/goal switch. The browser uses it to disable the
     * task-level option (and explain that the global switch must be turned on
     * first) WITHOUT rewriting anyone's stored per-task preference; the Host
     * freezes its own read per execution, so this mirror never governs a run in
     * flight.
     */
    goalRunEnabled?: boolean;
    /**
     * New-card defaults this deployment configures: what the create dialog opens
     * with, and what the create path fills an omitted target from when the caller
     * opts in (`applyCardDefaults`). A target the board configures nothing for is
     * omitted rather than published blank, so the browser can tell "no default
     * model" from "a blank one".
     */
    cardDefaults?: {
        mode?: string;
        permission?: TaskPermission;
        model?: string;
        reasoningEffort?: string;
    };
    /**
     * Read-only summaries published by running extensions, keyed by extension id.
     * The board forwards them verbatim; it never interprets their shape.
     */
    extensions?: Record<string, unknown>;
    /**
     * The attachment limits this deployment enforces, so the browser can refuse
     * an oversized selection before it uploads anything. The board's own caps
     * are the ceiling; a deployment whose attachment storage publishes stricter
     * image limits lowers the bounds it publishes here.
     */
    attachmentLimits?: {
        /** Maximum number of attachments one card may carry. */
        maxAttachments: number;
        /** Maximum byte length of one attachment. */
        maxBytes: number;
        /** Maximum byte length of all attachments of one card together. */
        maxTotalBytes: number;
        /** Maximum number of IMAGES one card may carry (the official per-message budget). */
        maxImages: number;
        /** Maximum byte length of one image. */
        maxImageBytes: number;
        /** Maximum byte length of all images of one card together (the official per-message budget). */
        maxMessageImageBytes: number;
    };
}
/**
 * Body of `GET {TASK_BOARD_API_PREFIX}/verification`: the acceptance settings the
 * card edits, the contract they resolve to right now, and the host model catalog
 * the model and reasoning choices come from. Served through the same loopback /
 * authenticated-proxy guard as the rest of the board API, and it carries no
 * credential material — model routes and level ids only.
 */
export interface TaskBoardVerificationOptions {
    settings: VerificationSettings;
    /** The RESOLVED contract, so the card can show what the next execution freezes. */
    contract: VerificationContract;
    catalog: ModelCatalogView;
}
/** SSE event frame: revision/scheduler/power only, never the task list. */
export interface TaskBoardEventPayload {
    revision: number;
    scheduler: TaskBoardSchedulerSnapshot;
    power: TaskBoardPowerSnapshot;
}
/**
 * Request body of `POST {TASK_BOARD_API_PREFIX}/parse` (issue #1540): the text
 * the user pasted plus the `provider/model` route that should parse it.
 */
export interface TaskBoardParseRequest {
    text: string;
    /** Qualified route from the model picker; absent when no route was chosen. */
    model?: string;
}
/** Draft fields a parse returns; the user reviews them before creating the task. */
export interface TaskBoardParseDraft {
    title: string;
    description: string;
    prompt: string;
}
/** Strict parse of a `/parse` request body; undefined rejects the request. */
export declare function parseTaskParseRequest(value: unknown): TaskBoardParseRequest | undefined;
/** Whether a decoded reply carries the three draft strings the form accepts. */
export declare function isTaskParseDraft(value: unknown): value is TaskBoardParseDraft;
export type TaskBoardAction = {
    kind: 'import';
    sourceId: string;
    tasks: TaskRecord[];
} | {
    kind: 'create';
    id: string;
    input: NewTaskInput;
} | {
    kind: 'update';
    taskId: string;
    patch: TaskUpdatePatch;
} | {
    kind: 'delete';
    taskId: string;
} | {
    kind: 'move';
    taskId: string;
    status: TaskStatus;
} | {
    kind: 'archive';
    taskId: string;
} | {
    kind: 'restore';
    taskId: string;
} | {
    kind: 'settle';
    taskId: string;
}
/** Clear the acceptance anomalies recorded on a card's open execution (issue #1828). */
 | {
    kind: 'reset-verification';
    taskId: string;
}
/**
 * Record an outcome an agent OUTSIDE the Host produced (issue #1826).
 *
 * It writes a real execution record, so the terminal column and the run
 * history both derive from that one record instead of a bare column edit.
 * `cancelled` is deliberately absent: nothing outside a DSH session may
 * claim the Host closed a run, and `running` must stay Host-only.
 */
 | {
    kind: 'record-external-outcome';
    taskId: string;
    result: 'succeeded' | 'failed';
    initiatedBy: string;
    summary?: string;
} | {
    kind: 'set-schedule';
    taskId: string;
    patch: SetSchedulePatch;
} | {
    kind: 'run';
    taskId: string;
} | {
    kind: 'rerun';
    taskId: string;
}
/**
 * Re-run an executed card in its own session, carrying rework instructions as
 * this run's additional input. Every run gate applies exactly as it does to
 * `rerun`, and the card's frozen content is never rewritten.
 */
 | {
    kind: 'rework';
    taskId: string;
    instructions: string;
} | {
    kind: 'confirm-permission';
    taskId: string;
} | {
    kind: 'set-parent';
    taskId: string;
    parentId: string | null;
}
/** Ledger-wide label management; see core/use-cases/task-tag.ts. */
 | {
    kind: 'rename-tag';
    from: string;
    to: string;
} | {
    kind: 'delete-tag';
    name: string;
} | {
    kind: 'extension-action';
    extensionId: string;
    action: string;
    taskId?: string;
    payload?: TaskBoardExtensionPayload;
};
export interface TaskBoardActionEnvelope {
    requestId: string;
    action: TaskBoardAction;
    /**
     * Session id of the DSH session issuing the action, for the execution audit
     * trail (issue #6). Client-asserted, not a trust boundary; parsed only as a
     * bounded non-empty string and recorded on opened executions / freeze stamps.
     */
    initiator?: string;
}
export declare function parseActionEnvelope(value: unknown): TaskBoardActionEnvelope | undefined;
