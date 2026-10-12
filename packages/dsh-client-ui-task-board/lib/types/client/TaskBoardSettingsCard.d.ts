/**
 * Task-board settings for availability, agent announcement, and optional Host
 * idle-sleep protection. Registers into the `web-ui.plugin.item` child slot
 * the Web UI plugin group renders, bound to the `task-board` namespace.
 */
import type { InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { TaskBoardExtensionDispatch } from '../core/extension.ts';
import { type CardActions, type CardShell, type FieldState as CardFieldState } from './settings-form.ts';
/** The task-board fields this card edits (the namespace's full schema). */
export interface TaskBoardSettings {
    /** Master switch for the plugin. */
    enabled?: boolean;
    /** Whether the board announces itself in every agent's system prompt. */
    announceToAgent?: boolean;
    /** Prevent host idle sleep while sessions run or schedules are armed. */
    preventIdleSleep?: boolean;
    /** Subtask depth limit (1..3); 1 means a single level of subtasks. */
    maxSubtaskDepth?: number;
    /** Roster-poll cadence in seconds while the board has work to reconcile. */
    sessionPollSeconds?: number;
    /**
     * GLOBAL native /goal switch (default off): the master control over whether
     * this board starts a run with dsh's built-in /goal at all. Frozen per
     * execution.
     */
    goalRunEnabled?: boolean;
    /** Goal acceptance for this board's executions (default on). */
    goalVerification?: boolean;
    /** Judge model route for goal acceptance; blank inherits the host default. */
    goalVerificationModel?: string;
    /** Judge reasoning effort; blank inherits the host default level. */
    goalVerificationReasoningEffort?: string;
}
/** What the task-board card renders. */
export interface TaskBoardSettingsCardState extends CardShell {
    /** Master switch. */
    enabled: CardFieldState;
    /** System-prompt announcement flag. */
    announceToAgent: CardFieldState;
    /** Idle-system-sleep protection flag. */
    preventIdleSleep: CardFieldState;
    /** Subtask depth limit field. */
    maxSubtaskDepth: CardFieldState;
    /** Roster-poll cadence field. */
    sessionPollSeconds: CardFieldState;
    /** GLOBAL native /goal switch. */
    goalRunEnabled: CardFieldState;
    /** Goal-acceptance switch. */
    goalVerification: CardFieldState;
    /** Judge model route field. */
    goalVerificationModel: CardFieldState;
    /** Judge reasoning-effort field. */
    goalVerificationReasoningEffort: CardFieldState;
}
/** The registration-side face the card's slot entry injects. */
export interface TaskBoardSettingsCardFace extends CardActions {
    hooks: {
        /** Card snapshot bound by the renderer as useTaskBoardSettingsCard. */
        taskBoardSettingsCard: SnapshotStore<TaskBoardSettingsCardState>;
    };
    /** Deliver one provider action over the board's same-origin channel. */
    dispatch: TaskBoardExtensionDispatch;
}
/** Bridges the `task-board` settings form onto the card's staged form. */
export declare class TaskBoardSettingsCardController {
    private readonly dispatch;
    private readonly form;
    private readonly store;
    /** @param scope - the bound configuration form for the `task-board` namespace. */
    constructor(scope: ConfigForm<TaskBoardSettings>, dispatch: TaskBoardExtensionDispatch);
    private projection;
    /**
     * Build the face the card's slot registration injects.
     * @returns the card's snapshot and its form actions.
     */
    inject(): TaskBoardSettingsCardFace;
    /**
     * Release the card's form subscription and bound stores; the slot
     * disposer calls this on teardown.
     */
    dispose(): void;
}
/** Props the renderer binds for the task-board card. */
export type TaskBoardSettingsCardProps = PropsRuntime<'web-ui.plugin.item'> & PropsLocale<'task-board'> & InjectFace<TaskBoardSettingsCardFace> & PropsRenderSlots<'task-board.settings.section'>;
/**
 * Render the task-board card.
 * @param props - locale copy, the card snapshot, and its form actions.
 * @returns the card.
 */
export declare function TaskBoardSettingsCard(props: TaskBoardSettingsCardProps): import("react").JSX.Element;
