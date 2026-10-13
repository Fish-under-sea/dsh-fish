import { type ToolDefinition } from '@deepseek-ai/dsh-tools';
import type { TaskBoardAction, TaskBoardSnapshot } from '../protocol.ts';
/**
 * The narrow Host face the tools need. TaskBoardHostService satisfies it
 * structurally, so tests and a future host can drive the same surface.
 */
export interface TaskBoardToolHost {
    /** Current board snapshot (tasks + scheduler + power + deployment constants). */
    snapshot(): TaskBoardSnapshot;
    /** Submit one confirmed Host action; returns the resulting snapshot. */
    apply(requestId: string, action: TaskBoardAction, initiator?: string): TaskBoardSnapshot | Promise<TaskBoardSnapshot>;
}
/** Registered tool names, in registration order. */
export declare const TASK_BOARD_TOOL_NAMES: readonly ["task_board_list", "task_board_get", "task_board_create", "task_board_update", "task_board_set_parent", "task_board_run", "task_board_manage", "task_board_schedule"];
/**
 * The calling session id, for the execution audit trail (the same stamp the
 * browser asserts). Absent when a call has no agent behind it.
 */
export declare function callingSessionId(exec: {
    agent?: unknown;
}): string | undefined;
/**
 * Build every task-board tool bound to one Host service.
 * @param host - the Host ledger/service face (TaskBoardHostService).
 * @returns the tool definitions, in TASK_BOARD_TOOL_NAMES order.
 */
export declare function buildTaskBoardTools(host: TaskBoardToolHost): ToolDefinition[];
