/**
 * Host loader entry for the task-board plugin.
 *
 * The Host owns the v2 ledger, action API, cron scheduler, session runner,
 * execution reconciliation, and optional idle-sleep inhibitor. The browser is
 * a same-origin asynchronous view over that service.
 */
import type { Context, Volatile } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import type { LlmRuntime } from '@deepseek-ai/dsh-llm';
import { type HostTimerFace, type TaskBoardTeamDispatcher } from './host-service.ts';
import { type TaskPermission } from './core/tasks.ts';
/** Default environment variable holding the authenticated proxy token. */
export declare const DEFAULT_PROXY_TOKEN_ENV = "DSH_TASK_BOARD_PROXY_TOKEN";
export declare const inject: string[];
/** Model-facing announcement: plugin presence, capabilities, and limits. */
export declare const TASK_BOARD_GUIDANCE = "\u672C\u673A\u5DF2\u5B89\u88C5 dsh-task-board \u63D2\u4EF6\uFF08DSH Web GUI \u7684\u4EFB\u52A1\u770B\u677F\uFF09\uFF1A\u4FA7\u8FB9\u680F\u300C\u4EFB\u52A1\u770B\u677F\u300D\u5165\u53E3\uFF1B\u5728 dsh-web \u63D2\u4EF6\u5168\u5BB6\u6876\u4ED3\u5E93\uFF08packages/dsh-task-board\uFF09\u7EDF\u4E00\u7EF4\u62A4\uFF0C\u7ECF\u805A\u5408\u5305 web-ui-all \u4E00\u952E\u5B89\u88C5\u3002\u80FD\u529B\uFF1A\u591A\u5217\u770B\u677F\u7BA1\u7406\u4EFB\u52A1\uFF1BHost \u6743\u5A01\u8D26\u672C\uFF1B\u5173\u95ED\u6D4F\u89C8\u5668\u540E\u4ECD\u7531 Host \u6267\u884C\u548C\u7ED3\u7B97\uFF1B\u4EFB\u52A1\u53EF\u9489\u4F4F\u5DE5\u4F5C\u533A\u3001agent \u9884\u8BBE\u548C\u6743\u9650\uFF1B\u4EFB\u52A1\u53EF\u5EFA\u5B50\u4EFB\u52A1\uFF08\u6DF1\u5EA6\u4E0A\u9650\u53EF\u914D 1..3\uFF0C\u9ED8\u8BA4 1 \u5C42\uFF0C\u5B50\u4EFB\u52A1\u4E0D\u80FD\u518D\u5E26\u5B50\u4EFB\u52A1\uFF09\uFF0C\u6267\u884C\u7236\u4EFB\u52A1\u4F1A\u5E76\u53D1\u6267\u884C\u5176\u5B50\u4EFB\u52A1\u6811\uFF0C\u5B50\u4EFB\u52A1\u53EF\u5355\u72EC\u8986\u76D6\u6743\u9650\u4E0E\u6A21\u578B\uFF1B\u53E6\u6CE8\u518C task_board_* agent \u5DE5\u5177\uFF08list/get/create/update/set_parent/run/manage/schedule\uFF09\uFF0C\u4EFB\u4F55\u4F1A\u8BDD\u90FD\u53EF\u76F4\u63A5\u8BFB\u5199\u770B\u677F\u3001\u5B50\u4EFB\u52A1\u4E0E\u5B9A\u65F6\u8BA1\u5212\uFF0C\u4F46\u8FD0\u884C\u4EFB\u52A1\u4F1A\u771F\u5B9E\u6267\u884C\u5E76\u6D88\u8017\u989D\u5EA6\uFF0C\u9AD8\u4E8E\u4F1A\u8BDD\u9ED8\u8BA4\u6743\u9650\u7684\u7ED1\u5B9A\u4ECD\u5FC5\u987B\u7531\u7528\u6237\u5728 GUI \u4EBA\u5DE5\u786E\u8BA4\uFF08\u5DE5\u5177\u523B\u610F\u4E0D\u63D0\u4F9B\u786E\u8BA4\u80FD\u529B\uFF09\uFF1B\u652F\u6301 Host \u672C\u5730\u65F6\u533A\u7684 5 \u6BB5 cron\uFF0C\u9519\u8FC7\u7684\u89E6\u53D1\u70B9\u4E0D\u8865\u8DD1\uFF1B\u53EF\u9009\u4E14\u9ED8\u8BA4\u5173\u95ED\u7684\u7A7A\u95F2\u7CFB\u7EDF\u7761\u7720\u4FDD\u62A4\u5141\u8BB8\u5C4F\u5E55\u7184\u706D\uFF0C\u4F46\u4E0D\u627F\u8BFA\u62E6\u622A\u5408\u76D6\u3001\u624B\u52A8\u7761\u7720\u3001\u4F11\u7720\u3001\u5173\u673A\u6216\u5524\u9192\u5DF2\u7761\u7720\u673A\u5668\u3002\u6267\u884C\u6D88\u8017 API \u989D\u5EA6\u3002\u7528\u6237\u63D0\u5230\u300C\u4EFB\u52A1\u770B\u677F / \u770B\u677F / \u5B9A\u65F6\u4EFB\u52A1\u300D\u65F6\u5373\u6307\u672C\u63D2\u4EF6\uFF0C\u8BF7\u636E\u6B64\u534F\u4F5C\u3002\u82E5\u4F60\u540C\u65F6\u7528 todo_write \u7EF4\u62A4\u4F1A\u8BDD\u9876\u90E8\u7684\u53EF\u89C1\u8BA1\u5212\u5217\u8868\uFF0C\u6700\u7EC8\u56DE\u590D\u524D\u5FC5\u987B\u518D\u6B21\u8C03\u7528 todo_write \u6536\u5C3E\uFF1A\u6CA1\u6709\u5269\u4F59\u5DE5\u4F5C\u65F6\u4E0D\u8981\u4FDD\u7559 in_progress\uFF0C\u5DF2\u5B8C\u6210\u7684\u6700\u540E\u4E00\u6B65\u8981\u6807\u4E3A completed\u3002";
/**
 * Plugin config, validated by the same-named schemastery schema.
 *
 * This schema IS the board's settings page: the 0.1.7 Host serves one
 * configuration form per profile entry from the entry's own Config, so the
 * fields the browser card edits are marked volatile — the Loader commits
 * an edit into the running fiber's references without remounting the row (no
 * settings document of the plugin's own exists any more). A field without the
 * marker is refused by the settings write path, which fences writes on
 * volatility.
 */
export interface Config {
    /**
     * When true (default), a system-prompt section announces the board to every
     * agent. Set false to keep the board silent in prompts; agents then learn
     * about it only when the user mentions it.
     */
    announceToAgent?: Volatile<boolean>;
    /** Master switch for the plugin (browser half + host announcement). */
    enabled?: Volatile<boolean>;
    /** Prevent idle system sleep while sessions run or schedules are armed. */
    preventIdleSleep?: Volatile<boolean>;
    /**
     * Canonical reverse-proxy Host authorities admitted with a server-side
     * token. Deployment-level, so it stays an ordinary field: editing it reloads
     * the row, which re-registers the routes with the new proxy access.
     */
    trustedProxyHosts?: string[];
    /** Environment variable whose value the authenticated proxy injects upstream. */
    proxyTokenEnv?: string;
    /**
     * An explicit baseline for the permission confirmation gate. Left unset, the
     * board follows the Host's own default permission preset — the value new DSH
     * sessions start at — and falls back to `read-only` when the deployment
     * serves no permission catalog. A card whose effective permission (handover
     * bundle or pin) is above the baseline requires a human confirmation before
     * it may run; cron refuses unconfirmed cards.
     */
    sessionDefaultPermission?: TaskPermission;
    /**
     * Subtask depth limit, 1..3 (default 1). At 1 a task may carry one level of
     * subtasks and a subtask cannot be given subtasks of its own; raising it
     * allows deeper trees. Every extra level multiplies the sessions one run
     * of the root task opens, so the ceiling is deliberately small.
     */
    maxSubtaskDepth?: Volatile<number>;
    /**
     * How often, in seconds, the Host re-reads the DSH session roster while the
     * board has something to reconcile: a running card, an open execution, or an
     * active provider extension. An idle board with none of those does not poll
     * at all, so this cadence only bounds how quickly a running card settles.
     */
    sessionPollSeconds?: Volatile<number>;
    /**
     * Continuable-subagent provider the Agent Teams service uses to compose a
     * teammate. Matches the Agent Teams tool plugin's `freshProvider` default;
     * only team-mode runs use it.
     */
    teamProvider?: string;
    /**
     * GLOBAL native /goal switch (default OFF), the master control over whether
     * this board starts a run with dsh's built-in /goal at all. A run uses native
     * /goal only when THIS is on AND the task's own `goalRun` is not off; while
     * it is off every task runs one plain turn.
     *
     * The value is frozen when an execution starts, so toggling it only affects
     * executions that begin afterwards and never re-writes a task's stored
     * `goalRun` preference. A run that consequently does not execute native
     * /goal is marked as such (its acceptance applicability is `goal-disabled`)
     * and is never reported as a passed goal acceptance or failed for lacking a
     * completion call. Independent of `goalVerification`; acceptance governs the
     * completing call of a goal-form run, this switch governs whether the run
     * becomes a goal run.
     */
    goalRunEnabled?: Volatile<boolean>;
    /**
     * Goal acceptance for executions this board starts (default ON). When on,
     * update_goal(action: complete) inside a task execution is refused until an
     * acceptance pass is recorded for that execution: the three coding criteria,
     * a 0.65 threshold, two rounds per criterion with the A/B slots swapped, and
     * at most two acceptances per execution — the first failure returns its
     * findings to the fixing agent, the second ends the cycle. The switch only
     * affects goal-form executions of the board; plain chat and a task pinned to
     * goalRun: false are untouched. When a separate third-party verifier also
     * runs its own automatic acceptance, both judges score independently: this
     * one gates completion, the other only steers, and no public interface lets
     * the two share a verdict.
     */
    goalVerification?: Volatile<boolean>;
    /**
     * Judge model for goal acceptance as provider/model. Blank inherits the HOST's
     * own model catalog default — never the card's pinned execution model.
     */
    goalVerificationModel?: Volatile<string>;
    /**
     * Reasoning effort for the judge. Blank inherits the host default level; an
     * effort the resolved model does not declare is dropped instead of being
     * sent, and the fallback to the model's own default is reported.
     */
    goalVerificationReasoningEffort?: Volatile<string>;
    /**
     * Ceiling of ONE judge request of a goal acceptance, in seconds
     * (30..600, default 150). One acceptance issues six judge requests (three
     * criteria times two rounds), so a ceiling that is too small turns a slow but
     * healthy judge route into a wall of timeouts, and every timeout was charged
     * as an acceptance anomaly. Raise it for a reasoning model reading a long
     * trace.
     */
    goalVerificationCallTimeoutSeconds?: Volatile<number>;
    /**
     * Total ceiling of ONE goal acceptance attempt, in seconds (120..1800,
     * default eight times the per-call default). Keep it at or above
     * `goalVerificationCallTimeoutSeconds` times six or an acceptance can never
     * finish: the attempt then ends early with a budget stop that judges nothing
     * and spends no acceptance budget.
     */
    goalVerificationBudgetSeconds?: Volatile<number>;
}
/**
 * Continuable-subagent provider for fresh teammates, matching the Agent Teams
 * tool plugin's own `freshProvider` default.
 */
export declare const DEFAULT_TEAM_PROVIDER = "spawn";
/**
 * Profile-patch shape of {@link Config}: what the Host validates the row's
 * config against, before the schema turns volatile fields into live references
 * and applies defaults. Declared separately because the two sides no longer
 * share one shape, so the schema is annotated `z<ConfigInput, Config>` — the
 * same split `dsh-git-graph` uses. The annotation is also what keeps the
 * emitted declaration portable: an unannotated schema holding a nested object
 * array infers a type that cannot be named without reaching into a transitive
 * dependency's own types.
 */
export interface ConfigInput {
    /** Announce the board in the system prompt. */
    announceToAgent?: boolean;
    /** Master switch for the plugin. */
    enabled?: boolean;
    /** Prevent idle system sleep while sessions run or schedules are armed. */
    preventIdleSleep?: boolean;
    /** Canonical reverse-proxy Host authorities. */
    trustedProxyHosts?: string[];
    /** Environment variable whose value the authenticated proxy injects. */
    proxyTokenEnv?: string;
    /** Explicit baseline for the permission confirmation gate; unset follows the Host default. */
    sessionDefaultPermission?: TaskPermission;
    /** Subtask depth limit, 1..3. */
    maxSubtaskDepth?: number;
    /** Roster-poll cadence in seconds while the board has work to reconcile. */
    sessionPollSeconds?: number;
    /** Continuable-subagent provider the Agent Teams service composes a teammate from. */
    teamProvider?: string;
    /** Global native /goal switch; default off, frozen per execution. */
    goalRunEnabled?: boolean;
    /** Goal acceptance switch. */
    goalVerification?: boolean;
    /** Judge model route for goal acceptance; blank inherits the host default. */
    goalVerificationModel?: string;
    /** Judge reasoning effort; blank inherits the host default. */
    goalVerificationReasoningEffort?: string;
    /** Ceiling of one judge request of a goal acceptance, in seconds. */
    goalVerificationCallTimeoutSeconds?: number;
    /** Total ceiling of one goal acceptance attempt, in seconds. */
    goalVerificationBudgetSeconds?: number;
}
export declare const Config: z<ConfigInput, Config>;
/** Schema default for the goal-acceptance switch, re-read for hand-built contexts. */
export declare const DEFAULT_GOAL_VERIFICATION = true;
/**
 * Schema default for the GLOBAL native-/goal switch, re-read for hand-built
 * contexts. Deliberately false: a deployment that never configured it (and
 * every card written before the option existed) runs plain single turns.
 */
export declare const DEFAULT_GOAL_RUN = false;
declare module '@deepseek-ai/cordis' {
    interface Events {
        /**
         * Volatile config values were committed into the running fiber without a
         * remount; dispatched to the owning fiber only. Spelled here because the
         * Loader package is not a dependency of this plugin, with the Loader's own
         * shape so the two declarations merge when a Host program carries both.
         * @param paths - changed config paths as key arrays; every value is committed before dispatch.
         * @mode emit
         */
        'loader/volatile-update'(paths: readonly (readonly string[])[]): void;
    }
}
/**
 * Read one config field's current value.
 *
 * The Loader hands schema-volatile fields as stable references it commits in
 * place, so a live value must be read at use time rather than captured when
 * the plugin activates; a plain value (a programmatic mount, or a field the
 * schema does not mark volatile) is returned as it stands.
 * @param field - the config field as the Loader handed it.
 * @param fallback - value to use when the field is absent.
 * @returns the effective field value.
 */
export declare function readConfigField<T>(field: Volatile<T> | T | undefined, fallback: T): T;
/** Resolve proxy access without ever placing the token value in plugin config. */
export declare function resolveProxyAccess(config: Config | undefined, env?: NodeJS.ProcessEnv): {
    trustedProxyHosts: string[];
    proxyToken?: string;
};
/** The registry face the agent tools register into. */
interface AgentToolRegistry {
    register(definition: ToolDefinition): () => void;
    /** Scoped lookup; present on the real registry, absent on a stub that only registers. */
    get?(name: string, scope?: unknown): unknown;
}
/**
 * Resolve the optional agent-tool registry. The board deliberately does not
 * inject it: a deployment whose runtime serves no registry must still mount the
 * whole board and lose only the agent-tool surface, the same tolerance the
 * optional llm service gets.
 * @param ctx - the plugin context.
 * @returns the registry, or undefined when this deployment serves none.
 */
export declare function resolveToolRegistry(ctx: Context): AgentToolRegistry | undefined;
/**
 * Resolve the native cordis timer service (dsh-base's own `cordis-plugin-timer`
 * row). The board arms its schedule through it so unloading the row clears
 * every pending timer with the owning fiber, instead of the row tracking raw
 * process handles by hand. A composition that serves no timer service keeps
 * working on the process globals.
 * @param ctx - the plugin context.
 * @returns the timer face, or undefined when this deployment serves none.
 */
export declare function resolveHostTimers(ctx: Context): HostTimerFace | undefined;
/**
 * The Host's own default permission preset, mapped into the board's vocabulary.
 *
 * This is the value new DSH sessions start at (the deployment's `permission`
 * settings row), so a board that follows it treats an ordinary card exactly as
 * the Host would. Absent when the deployment serves no permission catalog, or
 * its default is a current-session identity (`auto`) that names no fixed
 * sandbox mode; the caller then keeps the fail-safe baseline.
 * @param ctx - the plugin context.
 * @returns the Host default as a board permission, or undefined when unreadable.
 */
export declare function resolveHostDefaultPermission(ctx: Context): TaskPermission | undefined;
/** The subset of the Agent Teams service this plugin drives. */
interface AgentTeamsFace {
    spawnTeammate(caller: unknown, request: {
        name: string;
        description: string;
        prompt: Array<{
            type: 'text';
            text: string;
        }>;
        context: 'fresh' | 'fork';
        provider: string;
        signal: AbortSignal;
    }): Promise<{
        member?: {
            id?: string;
            phase?: string;
            error?: string;
        };
    }>;
}
/**
 * Resolve the optional Agent Teams service. Like the tool registry and the llm
 * runtime, it is deliberately not injected: a deployment without Agent Teams
 * must still mount the whole board and only lose team-mode runs.
 * @param ctx - the plugin context.
 * @returns the service, or undefined when this deployment serves none.
 */
export declare function resolveAgentTeams(ctx: Context): AgentTeamsFace | undefined;
/**
 * Build the team dispatcher: the run's Lead session spawns one teammate per
 * subtask through the Agent Teams service, and the teammate's session id is
 * attached to that subtask's execution so the ordinary session monitor settles
 * it. Returns undefined when the deployment serves no Agent Teams service or
 * no live-agent registry, which makes a team run fail closed.
 * @param ctx - the plugin context.
 * @param provider - the continuable-subagent provider for fresh teammates.
 * @returns the dispatcher, or undefined when team runs cannot be served.
 */
export declare function buildTeamDispatcher(ctx: Context, provider: string): TaskBoardTeamDispatcher | undefined;
/**
 * Read the optional `llm` service. The board deliberately does not inject it:
 * a deployment without a model must still mount the board, and the parse route
 * answers a typed failure instead of the plugin failing to load (issue #1540).
 * @param ctx - the plugin context.
 * @returns the llm service, or undefined when this deployment serves none.
 */
export declare function resolveLlmRuntime(ctx: Context): LlmRuntime | undefined;
/**
 * Activate the board's host half: ledger, routes, cron scheduler, power
 * inhibitor, and the model-facing announcement.
 *
 * The effective settings are the config the Host hands this row. The fields
 * the browser card edits are schema-volatile, so the Loader commits an
 * edit into the running fiber's references instead of remounting the row —
 * `sync` therefore reads them at use time and follows
 * `loader/volatile-update`, the event the Loader emits once it has committed
 * them. Every other field reloads the row, which re-runs this activation.
 * @param ctx - the plugin context (systemPrompt injected).
 * @param config - resolved plugin config (schema defaults applied by the loader).
 */
export declare const apply: typeof applyImpl;
declare function applyImpl(ctx: Context, config?: Config): void;
export {};
