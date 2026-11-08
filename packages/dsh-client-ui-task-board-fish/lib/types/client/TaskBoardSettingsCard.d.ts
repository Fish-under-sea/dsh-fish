/**
 * Task-board settings for availability, agent announcement, and optional Host
 * idle-sleep protection. Registers into the `web-ui.plugin.item` child slot
 * the Web UI plugin group renders, bound to the `task-board` namespace.
 */
import type { InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { TaskBoardExtensionDispatch } from '../core/extension.ts';
import type { ExecutionPresetOption } from '../core/controller.ts';
import { type CardActions, type CardShell, type FieldState as CardFieldState } from './settings-form.ts';
/** The task-board fields this card edits (the namespace's full schema). */
export interface TaskBoardSettings {
    /** Master switch for the plugin. */
    enabled?: boolean;
    /** Whether the board announces itself in every agent's system prompt. */
    announceToAgent?: boolean;
    /** Prevent host idle sleep while sessions run or schedules are armed. */
    preventIdleSleep?: boolean;
    /**
     * Whether the operator's own reverse proxy or tunnel may speak for the
     * browser (default off). Volatile, so the board's fence reads it per request.
     */
    trustForwardedProxy?: boolean;
    /** Subtask depth limit (1..3); 1 means a single level of subtasks. */
    maxSubtaskDepth?: number;
    /** Roster-poll cadence in seconds while the board has work to reconcile. */
    sessionPollSeconds?: number;
    /**
     * How many run launches may be in flight at once (1..16, default 3). One run
     * opens its whole subtree, so this bounds the burst of sessions a single run
     * action creates; members enter the running column in batches, none is dropped.
     */
    runLaunchWidth?: number;
    /**
     * Daily token ceiling for the work this board dispatches; 0 means no gate.
     * Tokens, not money: only DeepSeek's own routes are priced.
     */
    spendBudgetTokens?: number;
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
    /**
     * Agent preset the create dialog of this board opens with. Blank pins
     * nothing, so a new card follows the deployment default as before.
     */
    cardDefaultMode?: string;
    /** Permission the create dialog opens with; blank applies no default. */
    cardDefaultPermission?: string;
    /** Execution model route the create dialog opens with; blank applies none. */
    cardDefaultModel?: string;
    /**
     * Reasoning level bound to `cardDefaultModel`; it applies only while a
     * card's final model IS that configured route, and is inert without one.
     */
    cardDefaultReasoningEffort?: string;
}
/** What the task-board card renders. */
export interface TaskBoardSettingsCardState extends CardShell {
    /** Master switch. */
    enabled: CardFieldState;
    /** System-prompt announcement flag. */
    announceToAgent: CardFieldState;
    /** Idle-system-sleep protection flag. */
    preventIdleSleep: CardFieldState;
    /** Forwarded-request trust flag. */
    trustForwardedProxy: CardFieldState;
    /** Subtask depth limit field. */
    maxSubtaskDepth: CardFieldState;
    /** Roster-poll cadence field. */
    sessionPollSeconds: CardFieldState;
    /** Run-launch admission width field. */
    runLaunchWidth: CardFieldState;
    /** Daily token cap field. */
    spendBudgetTokens: CardFieldState;
    /** GLOBAL native /goal switch. */
    goalRunEnabled: CardFieldState;
    /** Goal-acceptance switch. */
    goalVerification: CardFieldState;
    /** Judge model route field. */
    goalVerificationModel: CardFieldState;
    /** Judge reasoning-effort field. */
    goalVerificationReasoningEffort: CardFieldState;
    /** New-card default agent preset. */
    cardDefaultMode: CardFieldState;
    /** New-card default permission. */
    cardDefaultPermission: CardFieldState;
    /** New-card default model route. */
    cardDefaultModel: CardFieldState;
    /** New-card default reasoning level. */
    cardDefaultReasoningEffort: CardFieldState;
    /**
     * The deployment's agent-preset roster, published by the runtime read the
     * plugin wires; undefined until it answers, which leaves the default-preset
     * field offering the inherit choice alone.
     */
    presets?: readonly ExecutionPresetOption[];
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
    /** The deployment's agent-preset roster, once its runtime read has answered. */
    private presets;
    /** @param scope - the bound configuration form for the `task-board` namespace. */
    constructor(scope: ConfigForm<TaskBoardSettings>, dispatch: TaskBoardExtensionDispatch);
    private projection;
    /**
     * Publish the deployment's agent-preset roster to the default-preset field.
     * The roster is a runtime fact read outside this card (src/client/index.ts
     * wires it once for both the board's pickers and this topic); it can arrive
     * late or not at all, and until it does the field lists the inherit choice
     * alone. This never blocks a save: a deployment that serves no roster still
     * has a writable settings document.
     * @param presets - the roster rows.
     */
    setPresetRoster(presets: readonly ExecutionPresetOption[]): void;
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
