/**
 * Task-board settings for availability, agent announcement, and optional Host
 * idle-sleep protection. Registers into the `web-ui.plugin.item` child slot
 * the Web UI plugin group renders, bound to the `task-board` namespace.
 */

import type { InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import { useEffect, useState } from 'react'
import type { TaskBoardPowerSnapshot, TaskBoardVerificationOptions } from '../protocol.ts'
import type { TaskBoardExtensionDispatch } from '../core/extension.ts'
import { resolveContract, type ModelCatalogView, type VerificationSettings } from '../core/verification.ts'
import { parseModelRoute } from '../core/verification.ts'
import { PluginSettingsCard, BooleanField, ChoiceField, ValueField } from './PluginSettingsCard.tsx'
import { SUBTASK_DEPTH_MAX, SUBTASK_DEPTH_MIN } from '../core/subtask.ts'
import { SESSION_POLL_MAX_SECONDS, SESSION_POLL_MIN_SECONDS } from '../core/poll-cadence.ts'
import { CardForm, booleanField, type CardActions, type CardShell, type FieldSpec, type FieldState as CardFieldState } from './settings-form.ts'
import settingsCss from './board-settings.module.css'

/** The depth choices the card offers, derived from the supported range. */
const SUBTASK_DEPTH_CHOICES: readonly string[] = Array.from(
  { length: SUBTASK_DEPTH_MAX - SUBTASK_DEPTH_MIN + 1 },
  (_, index) => String(SUBTASK_DEPTH_MIN + index),
)

/**
 * The roster-poll cadence field: a whole number of seconds inside the
 * supported range, because the Host schema (`sessionPollSeconds`) is numeric.
 * A draft outside the range blocks the save instead of staging a value the
 * Host would clamp behind the user's back.
 */
function sessionPollField(): FieldSpec {
  return {
    field: 'sessionPollSeconds',
    format: value => typeof value === 'number' && Number.isInteger(value) ? String(value) : '',
    parse: (text) => {
      const trimmed = text.trim()
      if (trimmed === '') return { kind: 'clear' }
      if (!/^\d+$/.test(trimmed)) return undefined
      const seconds = Number(trimmed)
      return seconds >= SESSION_POLL_MIN_SECONDS && seconds <= SESSION_POLL_MAX_SECONDS
        ? { kind: 'set', value: seconds }
        : undefined
    },
  }
}

/**
 * The depth field: a choice among the supported levels whose draft text is a
 * number, because the Host schema (`maxSubtaskDepth`) is numeric. A draft
 * outside the range blocks the save instead of staging a value the Host
 * refuses.
 */
function subtaskDepthField(): FieldSpec {
  return {
    field: 'maxSubtaskDepth',
    format: value => typeof value === 'number' && Number.isInteger(value) ? String(value) : '',
    parse: (text) => {
      const trimmed = text.trim()
      if (trimmed === '') return { kind: 'clear' }
      return SUBTASK_DEPTH_CHOICES.includes(trimmed) ? { kind: 'set', value: Number(trimmed) } : undefined
    },
  }
}

/**
 * The judge-model field: blank inherits the host model catalog default, and a
 * non-blank draft must be a qualified provider/model route. An unparseable
 * draft blocks the save instead of storing a route nothing can resolve.
 */
function judgeModelField(): FieldSpec {
  return {
    field: 'goalVerificationModel',
    format: value => typeof value === 'string' ? value : '',
    parse: (text) => {
      const trimmed = text.trim()
      if (trimmed === '') return { kind: 'clear' }
      return parseModelRoute(trimmed) === undefined ? undefined : { kind: 'set', value: trimmed }
    },
  }
}

/**
 * The reasoning-effort field. Any non-blank id is staged: which levels a model
 * accepts is decided by the host catalog, and the settings card shows the
 * resolved level (including a fallback) rather than guessing here.
 */
function judgeEffortField(): FieldSpec {
  return {
    field: 'goalVerificationReasoningEffort',
    format: value => typeof value === 'string' ? value : '',
    parse: (text) => {
      const trimmed = text.trim()
      return trimmed === '' ? { kind: 'clear' } : { kind: 'set', value: trimmed }
    },
  }
}

/** The task-board fields this card edits (the namespace's full schema). */
export interface TaskBoardSettings {
  /** Master switch for the plugin. */
  enabled?: boolean
  /** Whether the board announces itself in every agent's system prompt. */
  announceToAgent?: boolean
  /** Prevent host idle sleep while sessions run or schedules are armed. */
  preventIdleSleep?: boolean
  /** Subtask depth limit (1..3); 1 means a single level of subtasks. */
  maxSubtaskDepth?: number
  /** Roster-poll cadence in seconds while the board has work to reconcile. */
  sessionPollSeconds?: number
  /**
   * GLOBAL native /goal switch (default off): the master control over whether
   * this board starts a run with dsh's built-in /goal at all. Frozen per
   * execution.
   */
  goalRunEnabled?: boolean
  /** Goal acceptance for this board's executions (default on). */
  goalVerification?: boolean
  /** Judge model route for goal acceptance; blank inherits the host default. */
  goalVerificationModel?: string
  /** Judge reasoning effort; blank inherits the host default level. */
  goalVerificationReasoningEffort?: string
}

/** What the task-board card renders. */
export interface TaskBoardSettingsCardState extends CardShell {
  /** Master switch. */
  enabled: CardFieldState
  /** System-prompt announcement flag. */
  announceToAgent: CardFieldState
  /** Idle-system-sleep protection flag. */
  preventIdleSleep: CardFieldState
  /** Subtask depth limit field. */
  maxSubtaskDepth: CardFieldState
  /** Roster-poll cadence field. */
  sessionPollSeconds: CardFieldState
  /** GLOBAL native /goal switch. */
  goalRunEnabled: CardFieldState
  /** Goal-acceptance switch. */
  goalVerification: CardFieldState
  /** Judge model route field. */
  goalVerificationModel: CardFieldState
  /** Judge reasoning-effort field. */
  goalVerificationReasoningEffort: CardFieldState
}

/** The registration-side face the card's slot entry injects. */
export interface TaskBoardSettingsCardFace extends CardActions {
  hooks: {
    /** Card snapshot bound by the renderer as useTaskBoardSettingsCard. */
    taskBoardSettingsCard: SnapshotStore<TaskBoardSettingsCardState>
  }
  /** Deliver one provider action over the board's same-origin channel. */
  dispatch: TaskBoardExtensionDispatch
}

/** Bridges the `task-board` settings form onto the card's staged form. */
export class TaskBoardSettingsCardController {
  private readonly form: CardForm<TaskBoardSettings>
  private readonly store: SnapshotStore<TaskBoardSettingsCardState>

  /** @param scope - the bound configuration form for the `task-board` namespace. */
  constructor(scope: ConfigForm<TaskBoardSettings>, private readonly dispatch: TaskBoardExtensionDispatch) {
    this.form = new CardForm(scope, [
      booleanField('enabled'),
      booleanField('announceToAgent'),
      booleanField('preventIdleSleep'),
      subtaskDepthField(),
      sessionPollField(),
      booleanField('goalRunEnabled'),
      booleanField('goalVerification'),
      judgeModelField(),
      judgeEffortField(),
    ])
    this.store = this.form.bind(() => this.projection())
  }

  private projection(): TaskBoardSettingsCardState {
    return {
      ...this.form.shell(),
      enabled: this.form.field('enabled'),
      announceToAgent: this.form.field('announceToAgent'),
      preventIdleSleep: this.form.field('preventIdleSleep'),
      maxSubtaskDepth: this.form.field('maxSubtaskDepth'),
      sessionPollSeconds: this.form.field('sessionPollSeconds'),
      goalRunEnabled: this.form.field('goalRunEnabled'),
      goalVerification: this.form.field('goalVerification'),
      goalVerificationModel: this.form.field('goalVerificationModel'),
      goalVerificationReasoningEffort: this.form.field('goalVerificationReasoningEffort'),
    }
  }

  /**
   * Build the face the card's slot registration injects.
   * @returns the card's snapshot and its form actions.
   */
  inject(): TaskBoardSettingsCardFace {
    return { hooks: { taskBoardSettingsCard: this.store }, ...this.form.actions(), dispatch: this.dispatch }
  }

  /**
   * Release the card's form subscription and bound stores; the slot
   * disposer calls this on teardown.
   */
  dispose(): void {
    this.form.dispose()
  }
}

/** Props the renderer binds for the task-board card. */
export type TaskBoardSettingsCardProps =
  PropsRuntime<'web-ui.plugin.item'>
  & PropsLocale<'task-board'>
  & InjectFace<TaskBoardSettingsCardFace>
  & PropsRenderSlots<'task-board.settings.section'>

/** Kanban mark for the card header: three columns of unequal depth. */
function BoardMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2.2" y="2.6" width="3.9" height="12.8" rx="1.95" fill="currentColor" />
      <rect x="7.05" y="2.6" width="3.9" height="7.6" rx="1.95" fill="currentColor" />
      <rect x="11.9" y="2.6" width="3.9" height="10.2" rx="1.95" fill="currentColor" />
    </svg>
  )
}

/**
 * Render the task-board card.
 * @param props - locale copy, the card snapshot, and its form actions.
 * @returns the card.
 */
export function TaskBoardSettingsCard(props: TaskBoardSettingsCardProps) {
  const { t, renderSlot, dispatch } = props
  const state = props.useTaskBoardSettingsCard(snapshot => snapshot)
  const disabled = !state.writable
  const [power, setPower] = useState<TaskBoardPowerSnapshot | undefined>()
  const [verification, setVerification] = useState<TaskBoardVerificationOptions | undefined>()
  useEffect(() => {
    // The SSE channel already carries power on every real change and pushes
    // one frame on subscribe; polling the full /state snapshot every 5 s
    // re-cloned and re-serialized the whole ledger server-side for one field.
    let live = true
    void fetch('api/task-board/verification')
      .then(r => r.ok ? r.json() : undefined)
      .then((data: TaskBoardVerificationOptions | undefined) => {
        if (data?.catalog && live) setVerification(data)
      })
      .catch(() => {})
    const events = new EventSource('api/task-board/events')
    events.onmessage = (message: MessageEvent<string>): void => {
      try {
        const frame = JSON.parse(message.data) as { power?: TaskBoardPowerSnapshot }
        if (frame.power !== undefined && live) setPower(frame.power)
      } catch {
        // The settings form remains usable while the host status is reconnecting.
      }
    }
    return () => { live = false; events.close() }
  }, [])
  // The staged drafts drive the resolved preview, so an unsaved model or level
  // change already shows what the next execution would freeze (including a
  // reasoning-level fallback the target model forces).
  const catalog: ModelCatalogView = verification?.catalog ?? { groups: [] }
  const stagedSettings: VerificationSettings = {
    enabled: state.goalVerification.text !== 'false',
    model: state.goalVerificationModel.text,
    reasoningEffort: state.goalVerificationReasoningEffort.text,
  }
  const preview = resolveContract(stagedSettings, catalog)
  const inheritRoute = catalog.default
  const modelChoices = [
    {
      value: '',
      label: inheritRoute === undefined
        ? t('settings.goalVerificationModelInheritUnknown')
        : t('settings.goalVerificationModelInherit', { model: inheritRoute.provider + '/' + inheritRoute.model }),
    },
    ...catalog.groups.flatMap(group => group.models.map(model => ({
      value: group.id + '/' + model.id,
      label: (group.name ?? group.id) + ' · ' + (model.name ?? model.id),
    }))),
  ]
  const stagedRoute = parseModelRoute(stagedSettings.model) ?? (inheritRoute === undefined ? undefined : { provider: inheritRoute.provider, model: inheritRoute.model })
  const stagedEfforts = stagedRoute === undefined
    ? []
    : catalog.groups.find(group => group.id === stagedRoute.provider)?.models.find(model => model.id === stagedRoute.model)?.reasoning?.efforts ?? []
  const effortChoices = [
    {
      value: '',
      label: stagedRoute === undefined || stagedEfforts.length === 0
        ? t('settings.goalVerificationEffortInheritUnknown')
        : t('settings.goalVerificationEffortInherit', {
          effort: catalog.groups.find(group => group.id === stagedRoute.provider)?.models
            .find(model => model.id === stagedRoute.model)?.reasoning?.defaultEffort ?? t('settings.goalVerificationEffortInheritUnknown'),
        }),
    },
    ...stagedEfforts.map(effort => ({ value: effort.id, label: effort.name ?? effort.id })),
  ]
  const fieldProps = {
    overriddenLabel: t('settings.overridden'),
    resetLabel: t('settings.reset'),
    invalidLabel: t('settings.invalidNumber'),
    disabled,
  }
  // Chrome state of the nested disclosure cards below: they stage into this
  // card's form and are written by its one save, so they carry no footer and no
  // unsaved pill of their own (the outer header owns the pill).
  const nestedShell: CardShell = {
    available: true,
    exposed: true,
    writable: state.writable,
    dirty: false,
    invalid: state.invalid,
    saving: state.saving,
    failed: false,
  }
  return (
    <PluginSettingsCard
      t={t}
      titleKey="settings.title"
      descriptionKey="settings.description"
      icon={<BoardMark />}
      defaultOpen={false}
      state={state}
      renderChildrenWhenNotExposed
      hideNotExposedNotice
      onSave={props.save}
      onDiscard={props.discard}
    >
      {/* The board's own settings are nested disclosure cards, so an expanded
          card reads as a short topic list: the board and its runtime behavior,
          goal acceptance, and whatever a provider contributes (a provider
          extension registers into the seat rendered last). Every one
          of them starts collapsed and shares this card's single save. */}
      <ul className={settingsCss.nestedCards}>
        <PluginSettingsCard
          t={t}
          titleKey="settings.enabled"
          descriptionKey="settings.enabledCardHint"
          defaultOpen={false}
          hideFooter
          state={nestedShell}
          onSave={props.save}
          onDiscard={props.discard}
        >
          <BooleanField
            id="settings-task-board-enabled"
            label={t('settings.enabled')}
            hint={t('settings.enabledHint')}
            inheritLabel={t('settings.inherit')}
            onLabel={t('settings.on')}
            offLabel={t('settings.off')}
            {...fieldProps}
            {...state.enabled}
            onEdit={(text) => { props.edit('enabled', text) }}
            onReset={() => { props.resetField('enabled') }}
          />
          <BooleanField
            id="settings-task-board-announce"
            label={t('settings.announceToAgent')}
            hint={t('settings.announceToAgentHint')}
            inheritLabel={t('settings.inherit')}
            onLabel={t('settings.on')}
            offLabel={t('settings.off')}
            {...fieldProps}
            {...state.announceToAgent}
            onEdit={(text) => { props.edit('announceToAgent', text) }}
            onReset={() => { props.resetField('announceToAgent') }}
          />
          <BooleanField
            id="settings-task-board-prevent-idle-sleep"
            label={t('settings.preventIdleSleep')}
            hint={t('settings.preventIdleSleepHint')}
            inheritLabel={t('settings.inherit')}
            onLabel={t('settings.on')}
            offLabel={t('settings.off')}
            {...fieldProps}
            {...state.preventIdleSleep}
            onEdit={(text) => { props.edit('preventIdleSleep', text) }}
            onReset={() => { props.resetField('preventIdleSleep') }}
          />
          <ValueField
            id="settings-task-board-session-poll"
            label={t('settings.sessionPollSeconds')}
            hint={t('settings.sessionPollSecondsHint')}
            numeric
            {...fieldProps}
            {...state.sessionPollSeconds}
            onEdit={(text) => { props.edit('sessionPollSeconds', text) }}
            onReset={() => { props.resetField('sessionPollSeconds') }}
          />
          <ChoiceField
            id="settings-task-board-subtask-depth"
            label={t('settings.maxSubtaskDepth')}
            hint={t('settings.maxSubtaskDepthHint')}
            inheritLabel={t('settings.inherit')}
            choices={SUBTASK_DEPTH_CHOICES.map(value => ({
              value,
              label: t('settings.maxSubtaskDepthOption', { depth: value }),
            }))}
            {...fieldProps}
            {...state.maxSubtaskDepth}
            onEdit={(text) => { props.edit('maxSubtaskDepth', text) }}
            onReset={() => { props.resetField('maxSubtaskDepth') }}
          />
        </PluginSettingsCard>

        <PluginSettingsCard
          t={t}
          titleKey="settings.runBehaviorTitle"
          descriptionKey="settings.runBehaviorCardHint"
          defaultOpen={false}
          hideFooter
          state={nestedShell}
          onSave={props.save}
          onDiscard={props.discard}
        >
          <BooleanField
            id="settings-task-board-goal-run"
            label={t('settings.goalRunGlobal')}
            hint={t('settings.goalRunGlobalHint')}
            inheritLabel={t('settings.inherit')}
            onLabel={t('settings.on')}
            offLabel={t('settings.off')}
            {...fieldProps}
            {...state.goalRunEnabled}
            onEdit={(text) => { props.edit('goalRunEnabled', text) }}
            onReset={() => { props.resetField('goalRunEnabled') }}
          />
        </PluginSettingsCard>

        <PluginSettingsCard
          t={t}
          titleKey="settings.goalVerificationTitle"
          descriptionKey="settings.goalVerificationCardHint"
          defaultOpen={false}
          hideFooter
          state={nestedShell}
          onSave={props.save}
          onDiscard={props.discard}
        >
          <BooleanField
            id="settings-task-board-goal-verification"
          label={t('settings.goalVerification')}
          hint={t('settings.goalVerificationHint')}
          inheritLabel={t('settings.inherit')}
          onLabel={t('settings.on')}
          offLabel={t('settings.off')}
          {...fieldProps}
          {...state.goalVerification}
          onEdit={(text) => { props.edit('goalVerification', text) }}
          onReset={() => { props.resetField('goalVerification') }}
        />
          <ChoiceField
            id="settings-task-board-goal-verification-model"
            label={t('settings.goalVerificationModel')}
            hint={t('settings.goalVerificationModelHint')}
            inheritLabel={t('settings.inherit')}
            choices={modelChoices}
            {...fieldProps}
            {...state.goalVerificationModel}
            onEdit={(text) => { props.edit('goalVerificationModel', text) }}
            onReset={() => { props.resetField('goalVerificationModel') }}
          />
          <ChoiceField
            id="settings-task-board-goal-verification-effort"
            label={t('settings.goalVerificationEffort')}
            hint={t('settings.goalVerificationEffortHint')}
            inheritLabel={t('settings.inherit')}
            choices={effortChoices}
            {...fieldProps}
            {...state.goalVerificationReasoningEffort}
            onEdit={(text) => { props.edit('goalVerificationReasoningEffort', text) }}
            onReset={() => { props.resetField('goalVerificationReasoningEffort') }}
          />
          <p className={settingsCss.note}>{t('settings.goalVerificationResolved')}</p>
          {preview.route === undefined
            ? <p className={settingsCss.error}>{t('settings.goalVerificationRouteMissing')}</p>
            : (
              <ul className={settingsCss.resolvedList}>
                <li>{t('settings.goalVerificationResolvedModel', { model: preview.route.provider + '/' + preview.route.model })}</li>
                <li>
                  {preview.route.reasoningEffort === undefined
                    ? t('settings.goalVerificationResolvedNoEffort')
                    : t('settings.goalVerificationResolvedEffort', { effort: preview.route.reasoningEffort })}
                </li>
                <li>
                  {t('settings.goalVerificationResolvedSource', {
                    source: preview.modelSource === 'inherit'
                      ? t('settings.goalVerificationSourceInherit')
                      : t('settings.goalVerificationSourceExplicit'),
                  })}
                </li>
                <li>{t('settings.goalVerificationResolvedPreset', { threshold: String(preview.threshold) })}</li>
              </ul>
            )}
          {preview.effortFallback !== undefined && (
            <p className={settingsCss.note}>
              {preview.effortFallback.resolved === undefined
                ? t('settings.goalVerificationEffortFallbackNone', { requested: preview.effortFallback.requested })
                : t('settings.goalVerificationEffortFallback', {
                  requested: preview.effortFallback.requested,
                  resolved: preview.effortFallback.resolved,
                })}
            </p>
          )}
          {stagedSettings.model.trim() !== '' && parseModelRoute(stagedSettings.model) === undefined && (
            <p className={settingsCss.note}>{t('settings.goalVerificationModelInvalid')}</p>
          )}
        </PluginSettingsCard>

        {/* Provider sections: a family extension contributes its own nested
            settings card into this list through the seat this card declares —
            the family provider extension is the one that does. Each
            contributed card keeps its own chrome and save row, and an empty
            seat draws nothing. */}
        {renderSlot('task-board.settings.section', { dispatch })}
      </ul>
      {/* Live power facts and the battery caveat: small print under the topic
          cards, separated from them, instead of two body-size paragraphs. */}
      <div className={settingsCss.power}>
        <p className={settingsCss.powerLine}>
          {t('settings.powerStatus', {
            platform: power?.platform ?? t('settings.powerUnknown'),
            phase: power?.phase ?? t('settings.powerUnknown'),
            running: String(power?.runningSessions ?? 0),
            schedules: String(power?.armedSchedules ?? 0),
          })}
        </p>
        <p className={settingsCss.powerLine}>{t('settings.powerBoundary')}</p>
        {power?.lastError !== undefined && (
          <p className={settingsCss.powerError}>{t('settings.powerError', { error: power.lastError })}</p>
        )}
      </div>
    </PluginSettingsCard>
  )
}
