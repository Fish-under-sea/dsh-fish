/**
 * Host loader entry for the task-board plugin.
 *
 * The Host owns the v2 ledger, action API, cron scheduler, session runner,
 * execution reconciliation, and optional idle-sleep inhibitor. The browser is
 * a same-origin asynchronous view over that service.
 */

import type { Context, Volatile } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-commands'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-api-gateway'
import type {} from '@deepseek-ai/dsh-workspace'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-tools'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { LlmRuntime } from '@deepseek-ai/dsh-llm'
import { TaskBoardHostService, type HostTimerFace, type TaskBoardTeamDispatcher } from './host-service.ts'
import { parseTaskDraft, TaskParseError } from './host-ai.ts'
import { TASK_PERMISSIONS, isTaskPermission, type TaskPermission } from './core/tasks.ts'
import { DEFAULT_SUBTASK_DEPTH, SUBTASK_DEPTH_MAX, SUBTASK_DEPTH_MIN } from './core/subtask.ts'
import { DEFAULT_SESSION_POLL_SECONDS, SESSION_POLL_MAX_SECONDS, SESSION_POLL_MIN_SECONDS } from './core/poll-cadence.ts'
import {
  DEFAULT_VERIFICATION_BUDGET_SECONDS,
  DEFAULT_VERIFICATION_CALL_TIMEOUT_SECONDS,
  VERIFICATION_BUDGET_MAX_SECONDS,
  VERIFICATION_BUDGET_MIN_SECONDS,
  VERIFICATION_CALL_TIMEOUT_MAX_SECONDS,
  VERIFICATION_CALL_TIMEOUT_MIN_SECONDS,
  verificationBudgetMs,
  verificationCallTimeoutMs,
} from './core/verification-budget.ts'
import { DEFAULT_SESSION_PERMISSION } from './core/handover.ts'
import { buildTaskBoardTools, TASK_BOARD_TOOL_NAMES } from './host/agent-tools.ts'
import { PLUGIN_TOOL_SECTION_ORDERS, visibleToolText } from './tool-surface.ts'
import { makeTaskBoardRoutes } from './host-routes.ts'
import { TASK_BOARD_SERVICE_NAME, type TaskBoardExtension } from './core/extension.ts'
import { mountOnce } from './mount-once.ts'
import { createGoalVerificationGate, type GoalFace } from './host/verification-gate.ts'
import { normalizeCatalog, type ModelCatalogView, type VerificationSettings } from './core/verification.ts'
import { probeWorkspaceChanges } from './host/workspace-evidence.ts'

/** Order of the announcement section within the shared tool-guidance band. */
const SECTION_ORDER = PLUGIN_TOOL_SECTION_ORDERS['task-board']

/** Default environment variable holding the authenticated proxy token. */
export const DEFAULT_PROXY_TOKEN_ENV = 'DSH_TASK_BOARD_PROXY_TOKEN'

export const inject = ['systemPrompt', 'typertGateway', 'workspaceRegistry', 'webServer', 'agents', 'commands']

/** Model-facing announcement: plugin presence, capabilities, and limits. */
export const TASK_BOARD_GUIDANCE = '本机已安装 dsh-task-board 插件（DSH Web GUI 的任务看板）：侧边栏「任务看板」入口；在 dsh-web 插件全家桶仓库（packages/dsh-task-board）统一维护，经聚合包 web-ui-all 一键安装。能力：多列看板管理任务；Host 权威账本；关闭浏览器后仍由 Host 执行和结算；任务可钉住工作区、agent 预设和权限；任务可建子任务（深度上限可配 1..3，默认 1 层，子任务不能再带子任务），执行父任务会并发执行其子任务树，子任务可单独覆盖权限与模型；另注册 task_board_* agent 工具（list/get/create/update/set_parent/run/manage/schedule），任何会话都可直接读写看板、子任务与定时计划，但运行任务会真实执行并消耗额度，高于会话默认权限的绑定仍必须由用户在 GUI 人工确认（工具刻意不提供确认能力）；支持 Host 本地时区的 5 段 cron，错过的触发点不补跑；可选且默认关闭的空闲系统睡眠保护允许屏幕熄灭，但不承诺拦截合盖、手动睡眠、休眠、关机或唤醒已睡眠机器。执行消耗 API 额度。用户提到「任务看板 / 看板 / 定时任务」时即指本插件，请据此协作。若你同时用 todo_write 维护会话顶部的可见计划列表，最终回复前必须再次调用 todo_write 收尾：没有剩余工作时不要保留 in_progress，已完成的最后一步要标为 completed。'

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
  announceToAgent?: Volatile<boolean>
  /** Master switch for the plugin (browser half + host announcement). */
  enabled?: Volatile<boolean>
  /** Prevent idle system sleep while sessions run or schedules are armed. */
  preventIdleSleep?: Volatile<boolean>
  /**
   * Canonical reverse-proxy Host authorities admitted with a server-side
   * token. Deployment-level, so it stays an ordinary field: editing it reloads
   * the row, which re-registers the routes with the new proxy access.
   */
  trustedProxyHosts?: string[]
  /** Environment variable whose value the authenticated proxy injects upstream. */
  proxyTokenEnv?: string
  /**
   * An explicit baseline for the permission confirmation gate. Left unset, the
   * board follows the Host's own default permission preset — the value new DSH
   * sessions start at — and falls back to `read-only` when the deployment
   * serves no permission catalog. A card whose effective permission (handover
   * bundle or pin) is above the baseline requires a human confirmation before
   * it may run; cron refuses unconfirmed cards.
   */
  sessionDefaultPermission?: TaskPermission
  /**
   * Subtask depth limit, 1..3 (default 1). At 1 a task may carry one level of
   * subtasks and a subtask cannot be given subtasks of its own; raising it
   * allows deeper trees. Every extra level multiplies the sessions one run
   * of the root task opens, so the ceiling is deliberately small.
   */
  maxSubtaskDepth?: Volatile<number>
  /**
   * How often, in seconds, the Host re-reads the DSH session roster while the
   * board has something to reconcile: a running card, an open execution, or an
   * active provider extension. An idle board with none of those does not poll
   * at all, so this cadence only bounds how quickly a running card settles.
   */
  sessionPollSeconds?: Volatile<number>
  /**
   * Continuable-subagent provider the Agent Teams service uses to compose a
   * teammate. Matches the Agent Teams tool plugin's `freshProvider` default;
   * only team-mode runs use it.
   */
  teamProvider?: string
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
  goalRunEnabled?: Volatile<boolean>
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
  goalVerification?: Volatile<boolean>
  /**
   * Judge model for goal acceptance as provider/model. Blank inherits the HOST's
   * own model catalog default — never the card's pinned execution model.
   */
  goalVerificationModel?: Volatile<string>
  /**
   * Reasoning effort for the judge. Blank inherits the host default level; an
   * effort the resolved model does not declare is dropped instead of being
   * sent, and the fallback to the model's own default is reported.
   */
  goalVerificationReasoningEffort?: Volatile<string>
  /**
   * Ceiling of ONE judge request of a goal acceptance, in seconds
   * (30..600, default 150). One acceptance issues six judge requests (three
   * criteria times two rounds), so a ceiling that is too small turns a slow but
   * healthy judge route into a wall of timeouts, and every timeout was charged
   * as an acceptance anomaly. Raise it for a reasoning model reading a long
   * trace.
   */
  goalVerificationCallTimeoutSeconds?: Volatile<number>
  /**
   * Total ceiling of ONE goal acceptance attempt, in seconds (120..1800,
   * default eight times the per-call default). Keep it at or above
   * `goalVerificationCallTimeoutSeconds` times six or an acceptance can never
   * finish: the attempt then ends early with a budget stop that judges nothing
   * and spends no acceptance budget.
   */
  goalVerificationBudgetSeconds?: Volatile<number>
}

/**
 * Continuable-subagent provider for fresh teammates, matching the Agent Teams
 * tool plugin's own `freshProvider` default.
 */
export const DEFAULT_TEAM_PROVIDER = 'spawn'

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
  announceToAgent?: boolean
  /** Master switch for the plugin. */
  enabled?: boolean
  /** Prevent idle system sleep while sessions run or schedules are armed. */
  preventIdleSleep?: boolean
  /** Canonical reverse-proxy Host authorities. */
  trustedProxyHosts?: string[]
  /** Environment variable whose value the authenticated proxy injects. */
  proxyTokenEnv?: string
  /** Explicit baseline for the permission confirmation gate; unset follows the Host default. */
  sessionDefaultPermission?: TaskPermission
  /** Subtask depth limit, 1..3. */
  maxSubtaskDepth?: number
  /** Roster-poll cadence in seconds while the board has work to reconcile. */
  sessionPollSeconds?: number
  /** Continuable-subagent provider the Agent Teams service composes a teammate from. */
  teamProvider?: string
  /** Global native /goal switch; default off, frozen per execution. */
  goalRunEnabled?: boolean
  /** Goal acceptance switch. */
  goalVerification?: boolean
  /** Judge model route for goal acceptance; blank inherits the host default. */
  goalVerificationModel?: string
  /** Judge reasoning effort; blank inherits the host default. */
  goalVerificationReasoningEffort?: string
  /** Ceiling of one judge request of a goal acceptance, in seconds. */
  goalVerificationCallTimeoutSeconds?: number
  /** Total ceiling of one goal acceptance attempt, in seconds. */
  goalVerificationBudgetSeconds?: number
}

export const Config: z<ConfigInput, Config> = z.object({
  announceToAgent: z.boolean().default(false).volatile(),
  enabled: z.boolean().default(true).volatile(),
  preventIdleSleep: z.boolean().default(false).volatile(),
  trustedProxyHosts: z.array(z.string()).default([]),
  proxyTokenEnv: z.string().min(1).default(DEFAULT_PROXY_TOKEN_ENV),
  sessionDefaultPermission: z.union(TASK_PERMISSIONS),
  maxSubtaskDepth: z.number().min(SUBTASK_DEPTH_MIN).max(SUBTASK_DEPTH_MAX).default(DEFAULT_SUBTASK_DEPTH).volatile(),
  sessionPollSeconds: z.number().min(SESSION_POLL_MIN_SECONDS).max(SESSION_POLL_MAX_SECONDS).default(DEFAULT_SESSION_POLL_SECONDS).volatile(),
  teamProvider: z.string().min(1).default(DEFAULT_TEAM_PROVIDER),
  goalRunEnabled: z.boolean().default(false).volatile(),
  goalVerification: z.boolean().default(true).volatile(),
  goalVerificationModel: z.string().default('').volatile(),
  goalVerificationReasoningEffort: z.string().default('').volatile(),
  goalVerificationCallTimeoutSeconds: z.number().min(VERIFICATION_CALL_TIMEOUT_MIN_SECONDS).max(VERIFICATION_CALL_TIMEOUT_MAX_SECONDS).default(DEFAULT_VERIFICATION_CALL_TIMEOUT_SECONDS).volatile(),
  goalVerificationBudgetSeconds: z.number().min(VERIFICATION_BUDGET_MIN_SECONDS).max(VERIFICATION_BUDGET_MAX_SECONDS).default(DEFAULT_VERIFICATION_BUDGET_SECONDS).volatile(),
})

/** Schema default for the goal-acceptance switch, re-read for hand-built contexts. */
export const DEFAULT_GOAL_VERIFICATION = true

/**
 * Schema default for the GLOBAL native-/goal switch, re-read for hand-built
 * contexts. Deliberately false: a deployment that never configured it (and
 * every card written before the option existed) runs plain single turns.
 */
export const DEFAULT_GOAL_RUN = false

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
    'loader/volatile-update'(paths: readonly (readonly string[])[]): void
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
export function readConfigField<T>(field: Volatile<T> | T | undefined, fallback: T): T {
  if (field === undefined) return fallback
  if (typeof field === 'object' && field !== null && typeof (field as { get?: unknown }).get === 'function') {
    return (field as Volatile<T>).get() as T
  }
  return field as T
}

/** Resolve proxy access without ever placing the token value in plugin config. */
export function resolveProxyAccess(config: Config | undefined, env: NodeJS.ProcessEnv = process.env): { trustedProxyHosts: string[]; proxyToken?: string } {
  const trustedProxyHosts = config?.trustedProxyHosts ?? []
  if (trustedProxyHosts.length === 0) return { trustedProxyHosts }
  const proxyTokenEnv = config?.proxyTokenEnv ?? DEFAULT_PROXY_TOKEN_ENV
  if (proxyTokenEnv.trim() === '') throw new Error('task-board: proxyTokenEnv must not be empty')
  const proxyToken = env[proxyTokenEnv]
  if (proxyToken === undefined || proxyToken === '') {
    throw new Error(`task-board: trustedProxyHosts requires a non-empty ${proxyTokenEnv} environment variable`)
  }
  return { trustedProxyHosts, proxyToken }
}

/** The registry face the agent tools register into. */
interface AgentToolRegistry {
  register(definition: ToolDefinition): () => void
  /** Scoped lookup; present on the real registry, absent on a stub that only registers. */
  get?(name: string, scope?: unknown): unknown
}

/** The lookup half of a resolved registry, when it exposes one. */
function lookupOf(registry: AgentToolRegistry | undefined): { get: (name: string, scope?: unknown) => unknown } | undefined {
  return registry !== undefined && typeof registry.get === 'function' ? { get: registry.get.bind(registry) } : undefined
}

/**
 * Resolve the optional agent-tool registry. The board deliberately does not
 * inject it: a deployment whose runtime serves no registry must still mount the
 * whole board and lose only the agent-tool surface, the same tolerance the
 * optional llm service gets.
 * @param ctx - the plugin context.
 * @returns the registry, or undefined when this deployment serves none.
 */
export function resolveToolRegistry(ctx: Context): AgentToolRegistry | undefined {
  try {
    const tools = ctx.get('tools') as AgentToolRegistry | undefined
    return tools !== undefined && typeof tools.register === 'function' ? tools : undefined
  } catch {
    return undefined
  }
}

/**
 * Resolve the native cordis timer service (dsh-base's own `cordis-plugin-timer`
 * row). The board arms its schedule through it so unloading the row clears
 * every pending timer with the owning fiber, instead of the row tracking raw
 * process handles by hand. A composition that serves no timer service keeps
 * working on the process globals.
 * @param ctx - the plugin context.
 * @returns the timer face, or undefined when this deployment serves none.
 */
export function resolveHostTimers(ctx: Context): HostTimerFace | undefined {
  try {
    const timer = ctx.get('timer') as Partial<HostTimerFace> | undefined
    if (timer === undefined) return undefined
    return typeof timer.timeout === 'function' && typeof timer.interval === 'function'
      ? { timeout: timer.timeout.bind(timer), interval: timer.interval.bind(timer) }
      : undefined
  } catch {
    return undefined
  }
}

/** Schema default, re-read for hand-built test contexts (the loader applies them normally). */
const DEFAULT_ANNOUNCE = false

/** The subset of the official permission-preset service the board reads. */
interface PermissionPresetsFace {
  catalog(): { defaultPreset?: unknown }
}

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
export function resolveHostDefaultPermission(ctx: Context): TaskPermission | undefined {
  try {
    const presets = ctx.get('permissionPresets') as PermissionPresetsFace | undefined
    if (presets === undefined || typeof presets.catalog !== 'function') return undefined
    const preset = presets.catalog()?.defaultPreset
    return isTaskPermission(preset) ? preset : undefined
  } catch {
    return undefined
  }
}

/**
 * How long one teammate may take to reach its durable active or failed edge.
 * Agent Teams provisioning normally resolves in seconds; the bound exists so a
 * hung spawn settles the subtask instead of holding the cascade open forever.
 */
const TEAMMATE_PROVISION_TIMEOUT_MS = 600_000

/** The subset of the Agent Teams service this plugin drives. */
interface AgentTeamsFace {
  spawnTeammate(caller: unknown, request: {
    name: string
    description: string
    prompt: Array<{ type: 'text'; text: string }>
    context: 'fresh' | 'fork'
    provider: string
    signal: AbortSignal
  }): Promise<{ member?: { id?: string; phase?: string; error?: string } }>
}

/**
 * Resolve the optional Agent Teams service. Like the tool registry and the llm
 * runtime, it is deliberately not injected: a deployment without Agent Teams
 * must still mount the whole board and only lose team-mode runs.
 * @param ctx - the plugin context.
 * @returns the service, or undefined when this deployment serves none.
 */
export function resolveAgentTeams(ctx: Context): AgentTeamsFace | undefined {
  try {
    const teams = ctx.get('agentTeams') as AgentTeamsFace | undefined
    return teams !== undefined && typeof teams.spawnTeammate === 'function' ? teams : undefined
  } catch {
    return undefined
  }
}

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
export function buildTeamDispatcher(ctx: Context, provider: string): TaskBoardTeamDispatcher | undefined {
  const teams = resolveAgentTeams(ctx)
  if (teams === undefined) return undefined
  if (typeof (ctx.agents as { get?: unknown } | undefined)?.get !== 'function') return undefined
  return {
    async spawn(input) {
      const lead = ctx.agents.get(input.leadSessionId as Parameters<typeof ctx.agents.get>[0])
      if (lead === undefined) return { error: `lead session ${input.leadSessionId} is not live` }
      try {
        const result = await teams.spawnTeammate(lead, {
          name: input.name,
          description: input.description,
          prompt: [{ type: 'text', text: input.prompt }],
          context: 'fresh',
          provider,
          signal: AbortSignal.timeout(TEAMMATE_PROVISION_TIMEOUT_MS),
        })
        const member = result?.member
        if (member === undefined) return { error: 'Agent Teams returned no teammate' }
        if (member.phase === 'failed') return { error: member.error ?? 'teammate provisioning failed' }
        if (typeof member.id !== 'string' || member.id === '') return { error: 'Agent Teams returned no teammate session' }
        return { sessionId: member.id }
      } catch (error) {
        return { error: `teammate provisioning failed: ${error instanceof Error ? error.message : String(error)}` }
      }
    },
  }
}

/**
 * Read the optional `llm` service. The board deliberately does not inject it:
 * a deployment without a model must still mount the board, and the parse route
 * answers a typed failure instead of the plugin failing to load (issue #1540).
 * @param ctx - the plugin context.
 * @returns the llm service, or undefined when this deployment serves none.
 */
export function resolveLlmRuntime(ctx: Context): LlmRuntime | undefined {
  try {
    const llm = ctx.get('llm') as LlmRuntime | undefined
    return llm !== undefined && typeof (llm as { stream?: unknown }).stream === 'function' ? llm : undefined
  } catch {
    return undefined
  }
}

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
export const apply = mountOnce('@fish-under-sea/dsh-client-ui-task-board', applyImpl)

function applyImpl(ctx: Context, config?: Config): void {
  /** Current master switch (the browser half reads the same field from its own form). */
  const enabled = (): boolean => readConfigField(config?.enabled, true)
  /** Current announcement flag. */
  const announceToAgent = (): boolean => readConfigField(config?.announceToAgent, DEFAULT_ANNOUNCE)
  /** Current idle-sleep protection flag. */
  const preventIdleSleep = (): boolean => readConfigField(config?.preventIdleSleep, false)
  /** Current subtask depth limit (read live: the settings card edits it in place). */
  const maxSubtaskDepth = (): number => readConfigField(config?.maxSubtaskDepth, DEFAULT_SUBTASK_DEPTH)
  /** Current roster-poll cadence in seconds (read live: the settings card edits it in place). */
  const sessionPollSeconds = (): number => readConfigField(config?.sessionPollSeconds, DEFAULT_SESSION_POLL_SECONDS)
  /**
   * The baseline the permission confirmation gate judges against: the row's own
   * `sessionDefaultPermission` when the deployment pins one, otherwise the Host's
   * default preset. Read per call through the ledger, so a Host Settings change
   * reaches the running board without remounting the row; the fail-safe default
   * still applies when no catalog is available.
   */
  const sessionDefaultPermission = (): TaskPermission =>
    config?.sessionDefaultPermission ?? resolveHostDefaultPermission(ctx) ?? DEFAULT_SESSION_PERMISSION

  /** Live acceptance settings the contract of each new execution freezes. */
  const verificationSettings = (): VerificationSettings => ({
    enabled: readConfigField(config?.goalVerification, DEFAULT_GOAL_VERIFICATION),
    model: readConfigField(config?.goalVerificationModel, ''),
    reasoningEffort: readConfigField(config?.goalVerificationReasoningEffort, ''),
  })
  /**
   * The acceptance time ceilings, read live: raising one must unblock a card
   * whose acceptance is stuck on a slow judge route without a remount, so
   * these deliberately are NOT frozen into the per-execution contract.
   */
  const verificationCallTimeoutMsLive = (): number =>
    verificationCallTimeoutMs(readConfigField(config?.goalVerificationCallTimeoutSeconds, DEFAULT_VERIFICATION_CALL_TIMEOUT_SECONDS))
  const verificationBudgetMsLive = (): number =>
    verificationBudgetMs(readConfigField(config?.goalVerificationBudgetSeconds, DEFAULT_VERIFICATION_BUDGET_SECONDS))
  // The catalog reader needs the service, and the service needs the reader;
  // the reader only runs after start(), so a late holder is enough.
  let hostForCatalog: TaskBoardHostService | undefined
  const verificationCatalog = async (): Promise<ModelCatalogView | undefined> => {
    const runner = hostForCatalog?.runner
    return runner === undefined ? undefined : normalizeCatalog(await runner.modelCatalog())
  }
  /**
   * Live reader of the GLOBAL native-/goal switch. The service calls it exactly
   * once per execution and carries the value, so a settings edit only reaches
   * executions that start afterwards.
   */
  const goalRunEnabled = (): boolean => readConfigField(config?.goalRunEnabled, DEFAULT_GOAL_RUN)
  const host = new TaskBoardHostService(ctx.typertGateway, {
    workspaceRegistry: ctx.workspaceRegistry,
    sessionDefaultPermission,
    maxSubtaskDepth: maxSubtaskDepth(),
    goalRunEnabled,
    verificationSettings,
    verificationCatalog,
    timers: resolveHostTimers(ctx),
    team: buildTeamDispatcher(ctx, config?.teamProvider ?? DEFAULT_TEAM_PROVIDER),
    commandDispatcher: {
      async execute(sessionId, line, signal) {
        const agent = ctx.agents.get(sessionId)
        if (agent === undefined) throw new Error(`execution session ${sessionId} is not available`)
        return (await ctx.commands.execute(agent, line, [], signal))?.result
      },
    },
  })
  hostForCatalog = host
  // Configuration before start(): a disabled row must not take the first
  // scheduler tick, which would roll schedules the board is not running.
  host.setConfiguration(enabled(), preventIdleSleep(), sessionPollSeconds())
  host.start()

  // External providers. The board publishes its registration service so any
  // provider package can resolve it and admit itself; the board itself knows
  // no provider vocabulary. A capture-only test context implements no service
  // registry and the board still serves its own surfaces.
  if (typeof (ctx as { provide?: unknown }).provide === 'function') {
    ctx.provide(TASK_BOARD_SERVICE_NAME, {
      registerExtension: (extension: TaskBoardExtension) => host.registerExtension(extension),
      isExtensionEnabled: (extensionId: string) => host.extensions.isActive(extensionId),
    })
  }

  // Agent tools: the same Host ledger the browser drives, so any session can
  // list, create, link, run and settle board work. Registration follows the
  // master switch (a disabled board answers no tool call), and the mount
  // effect below owns the disposers. Provider tools register through the
  // extension registry, which follows the same gate and rebinds when the tool
  // registry appears late.
  let disposeTools: (() => void) | undefined
  const setToolsEnabled = (active: boolean): void => {
    if (!active) {
      // Releasing is the whole job on the way down. Rebinding the extension
      // registry here would re-register every provider tool, and the teardown
      // path runs this while the fiber is already unloading, so each of those
      // re-registrations is a request the host can only refuse.
      disposeTools?.()
      disposeTools = undefined
      return
    }
    host.extensions.setToolRegistry(() => resolveToolRegistry(ctx))
    if (disposeTools !== undefined) return
    const registry = resolveToolRegistry(ctx)
    if (registry === undefined) return
    const disposers = buildTaskBoardTools(host).map(tool => registry.register(tool))
    disposeTools = () => {
      for (const dispose of disposers.splice(0)) dispose()
    }
  }
  setToolsEnabled(enabled())
  // A registry that activates after this row (or a row activated before it) is
  // followed through scoped injection where the runtime serves one; capture-only
  // contexts without it register through the direct resolution above.
  const scopedInject = (ctx as { inject?: (names: readonly string[], callback: (scoped: Context) => unknown) => unknown }).inject
  if (typeof scopedInject === 'function') {
    scopedInject.call(ctx, ['tools'], () => {
      setToolsEnabled(enabled())
      // The extension registry follows the same rebinding: a registry that
      // appears (or is replaced) after a provider started adopts its tools.
      host.extensions.setToolRegistry(() => resolveToolRegistry(ctx))
      // Cordis unloads and re-runs this callback when the injected service's
      // provider fiber changes, and the old registry dies with its provider.
      // Releasing the guard here is what lets the callback register into the
      // NEW registry instead of short-circuiting on the stale disposer.
      return () => {
        disposeTools?.()
        disposeTools = undefined
      }
    })
  }

  ctx.effect(() => {
    const disposers: Array<() => void> = []
    try {
      // The goal acceptance gate: the OFFICIAL tool pre-execution lifecycle,
      // installed before the tool body runs, so a completion claim cannot take
      // effect without a matching acceptance pass record.
      const gate = createGoalVerificationGate({
        ledger: host.ledger,
        llm: () => resolveLlmRuntime(ctx),
        goals: () => {
          try {
            return ctx.get('goals') as GoalFace | undefined
          } catch {
            return undefined
          }
        },
        // The host's own observation of what a turn changed on disk, when this
        // deployment records it; the acceptance degrades to the trajectory alone
        // when it does not.
        workspaceChanges: () => probeWorkspaceChanges(ctx),
        callTimeoutMs: verificationCallTimeoutMsLive,
        budgetMs: verificationBudgetMsLive,
        logger: {
          warn: (message: string, ...rest: unknown[]) => {
            const logger = (ctx as { logger?: { warn?: (...args: unknown[]) => void } }).logger
            if (typeof logger?.warn === 'function') logger.warn(message, ...rest)
            else console.warn(message, ...rest)
          },
        },
      })
      // A capture-only context may implement no listener registry (it returns
      // no disposer), so the handle is pushed only when it really is one.
      const offGate = ctx.on('tools/pre-execute', async (exec, next) => {
        const decision = await gate({ name: exec.name, arguments: exec.arguments, agent: exec.agent, signal: exec.signal })
        return decision ?? next()
      })
      if (typeof offGate === 'function') disposers.push(offGate)
      else if (typeof (offGate as { dispose?: unknown } | undefined)?.dispose === 'function') {
        const handle = offGate as { dispose(): void }
        disposers.push(() => { handle.dispose() })
      }
      const routes = makeTaskBoardRoutes(host, resolveProxyAccess(config), {
        parseTask: async (request, signal) => {
          const llm = resolveLlmRuntime(ctx)
          if (llm === undefined) throw new TaskParseError('no-model', 'this deployment serves no llm service')
          return await parseTaskDraft(llm, request, signal)
        },
      })
      for (const route of routes) disposers.push(ctx.webServer.register(route))
    } catch (error) {
      // A failed mount must not leave the agent tools bound to a disposed
      // host: the effect cleanup never runs when this body throws.
      setToolsEnabled(false)
      for (const dispose of disposers) dispose()
      host.dispose()
      throw error
    }
    return () => {
      setToolsEnabled(false)
      for (const dispose of disposers) dispose()
      host.dispose()
    }
  }, 'task-board: host ledger, scheduler, and routes')

  let disposeSection: (() => void) | undefined
  let applied: { enabled: boolean; announceToAgent: boolean; preventIdleSleep: boolean; maxSubtaskDepth: number; sessionPollSeconds: number } | undefined

  // Apply the current values to the host service and the announcement. A
  // commit that changes nothing visible is a no-op, so following a coarse
  // invalidation cannot churn the system-prompt registry. The section is kept
  // under one disposer: re-registering first tears the old one down so a
  // duplicate-name registration never throws.
  const sync = (): void => {
    const next = {
      enabled: enabled(),
      announceToAgent: announceToAgent(),
      preventIdleSleep: preventIdleSleep(),
      maxSubtaskDepth: maxSubtaskDepth(),
      sessionPollSeconds: sessionPollSeconds(),
    }
    if (applied !== undefined && applied.enabled === next.enabled && applied.announceToAgent === next.announceToAgent && applied.preventIdleSleep === next.preventIdleSleep && applied.maxSubtaskDepth === next.maxSubtaskDepth && applied.sessionPollSeconds === next.sessionPollSeconds) {
      return
    }
    applied = next
    host.ledger.setMaxSubtaskDepth(next.maxSubtaskDepth)
    host.setConfiguration(next.enabled, next.preventIdleSleep, next.sessionPollSeconds)
    setToolsEnabled(next.enabled)
    if (disposeSection !== undefined) {
      disposeSection()
      disposeSection = undefined
    }
    if (!next.enabled || !next.announceToAgent) return
    disposeSection = ctx.systemPrompt.section({
      name: 'plugin:task-board',
      order: SECTION_ORDER,
      // The announcement names the task_board_* tools, so it renders only while
      // at least one of them is reachable: a runtime that serves no tool
      // registry, or a restriction that withholds them, must not leave guidance
      // telling the model to call tools this session cannot see.
      text: visibleToolText(lookupOf(resolveToolRegistry(ctx)), TASK_BOARD_TOOL_NAMES, TASK_BOARD_GUIDANCE),
    })
  }

  // A settings edit of a volatile field is committed into the references this
  // fiber already holds, with no remount and no second call to apply: the
  // commit event is what makes the edit take effect without a restart.
  ctx.on('loader/volatile-update', () => { sync() })
  sync()
}
