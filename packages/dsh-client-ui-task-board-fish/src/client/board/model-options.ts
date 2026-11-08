/**
 * Execution model options: the picker rows built from the official
 * `session/modelCatalog` reply, and the reasoning-effort derivation both
 * execution-target editors read off them (the create dialog and the detail
 * page share one contract here, so they cannot promise different levels).
 *
 * The pickers must offer each model's real reasoning levels, which only the
 * catalog declares — so the reply is normalized once, here, instead of every
 * picker re-reading the wire shape. The fallback discovery path carries no
 * capability metadata at all; its rows stay silent about reasoning rather than
 * claiming a model supports none.
 *
 * This module also owns the one display form a model row is shown in: the
 * model name, then the provider that publishes it. Two providers may publish
 * one model name, and they are two different routes, so a picker that shows
 * only the name offers two identical rows. Every picker and every collapsed
 * summary reads the label from here, so they cannot drift apart.
 */
import type { ExecutionModelOption } from '../../core/controller.ts'
import type { TaskBoardKey } from '../locales.ts'

/** One model's declared reasoning capability, as a picker row carries it. */
type ModelReasoning = NonNullable<ExecutionModelOption['reasoning']>

/** A plain JSON object, or undefined for anything else (including arrays). */
function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

/** A non-empty string, or undefined. */
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** The effort ids an adapter published for one model, in catalog order. */
function effortIdsOf(reasoning: Record<string, unknown>): string[] {
  const efforts: string[] = []
  for (const entry of Array.isArray(reasoning.efforts) ? reasoning.efforts : []) {
    const id = text(record(entry)?.id)
    if (id !== undefined && !efforts.includes(id)) efforts.push(id)
  }
  return efforts
}

/**
 * What the catalog declares about one model's reasoning: a published
 * `reasoning` block is what "this route reasons" means, and a model published
 * without one is declared to have none. A model the reply never described at
 * all is a different state, expressed by the row carrying no capability.
 */
function reasoningOf(model: Record<string, unknown>): ModelReasoning {
  const reasoning = record(model.reasoning)
  if (reasoning === undefined) return { supported: false }
  const efforts = effortIdsOf(reasoning)
  return { supported: true, ...(efforts.length === 0 ? {} : { efforts }) }
}

/**
 * One picker row, or undefined when the entry carries no usable id.
 * @param withCapability - whether this reply declares reasoning metadata at
 * all; the flat discovery list does not, so its rows stay silent about it.
 */
function rowOf(model: Record<string, unknown>, provider: string | undefined, withCapability: boolean): ExecutionModelOption | undefined {
  const id = text(model.id)
  if (id === undefined) return undefined
  const reasoning = withCapability ? reasoningOf(model) : undefined
  return {
    id: provider === undefined ? id : `${provider}/${id}`,
    name: text(model.name) ?? id,
    ...(provider === undefined ? {} : { provider }),
    ...(reasoning === undefined ? {} : { reasoning }),
  }
}

/**
 * Normalize a `session/modelCatalog` reply into picker rows: one row per model
 * of every provider group, keyed by the qualified route an execution pins.
 * @param value - the raw catalog reply.
 * @returns the rows, empty when the reply is unreadable.
 */
export function modelOptionsFromCatalog(value: unknown): ExecutionModelOption[] {
  const options: ExecutionModelOption[] = []
  const groups = record(value)?.groups
  for (const entry of Array.isArray(groups) ? groups : []) {
    const group = record(entry)
    if (group === undefined) continue
    const provider = text(group.id) ?? text(group.provider)
    for (const item of Array.isArray(group.models) ? group.models : []) {
      const model = record(item)
      if (model === undefined) continue
      const row = rowOf(model, provider, true)
      if (row !== undefined) options.push(row)
    }
  }
  return options
}

/**
 * Normalize the flat `llm/discoverModels` list into picker rows. That reply
 * names models only, so every row leaves the reasoning capability unknown.
 * @param value - the raw discovery list.
 * @returns the rows, empty when the list is unreadable.
 */
export function modelOptionsFromDiscoveredModels(value: unknown): ExecutionModelOption[] {
  const options: ExecutionModelOption[] = []
  for (const item of Array.isArray(value) ? value : []) {
    const model = record(item)
    if (model === undefined) continue
    const row = rowOf(model, undefined, false)
    if (row !== undefined) options.push(row)
  }
  return options
}

/**
 * The display form of one model row: the model name first, then the provider
 * that publishes it, joined by " · ".
 *
 * Two providers publishing one model name are two different routes, so the
 * provider belongs in the label — otherwise the picker offers two identical
 * rows and the operator cannot tell which route a card would pin. A row
 * without a provider (the flat discovery fallback names models only) keeps
 * its bare name, and a row that carries no name of its own shows the model
 * part of its own qualified route, so the provider is never printed twice.
 * @param model - the roster row.
 * @returns the label every model picker row and every collapsed summary shows.
 */
export function modelDisplayLabel(model: ExecutionModelOption): string {
  const provider = model.provider === undefined || model.provider === '' ? undefined : model.provider
  const name = model.name !== undefined && model.name !== ''
    ? model.name
    : provider !== undefined && model.id.startsWith(provider + '/')
      ? model.id.slice(provider.length + 1)
      : model.id
  if (provider === undefined) return name
  return name + ' · ' + provider
}

/**
 * The picker rows of a model roster: the qualified `provider/model` route as
 * the value a pin stores, and the shared display form as the label, so two
 * providers offering one model name stay distinguishable.
 * @param models - the roster rows.
 * @returns the choice rows, in roster order.
 */
export function modelChoiceRows(models: readonly ExecutionModelOption[]): Array<{ value: string; label: string }> {
  return models.map(model => ({
    value: model.id,
    label: modelDisplayLabel(model),
  }))
}

/**
 * The capability row the roster publishes for one model route.
 * @returns undefined when no model is pinned, or the roster does not describe
 * the pinned one — an unknown model is not the same as a model without
 * reasoning.
 */
export function reasoningOfModel(
  models: readonly ExecutionModelOption[],
  modelId: string,
): ExecutionModelOption['reasoning'] | undefined {
  if (modelId === '') return undefined
  return models.find(item => item.id === modelId)?.reasoning
}

/**
 * The effort ids the picker offers for a model, in catalog order.
 * @returns an empty list when the model is unpinned, unknown, declares no
 * reasoning, or publishes no selectable level.
 */
export function reasoningEffortsFor(models: readonly ExecutionModelOption[], modelId: string): string[] {
  const reasoning = reasoningOfModel(models, modelId)
  return reasoning?.supported === true ? [...reasoning.efforts ?? []] : []
}

/** Whether the effort picker may be operated: a pinned model with declared, selectable levels. */
export function reasoningPickerEnabled(models: readonly ExecutionModelOption[], modelId: string): boolean {
  return reasoningEffortsFor(models, modelId).length > 0
}

/**
 * The effort to keep when the picked model changes. Only a model that declares
 * its levels can invalidate one: a model the roster cannot describe keeps the
 * stored value, because the roster has no grounds to call it invalid.
 * @param effort - the effort currently stored/selected ('' = follow the default).
 * @returns the effort to keep.
 */
export function reconcileReasoningEffort(
  models: readonly ExecutionModelOption[],
  modelId: string,
  effort: string,
): string {
  if (effort === '') return ''
  const reasoning = reasoningOfModel(models, modelId)
  if (reasoning === undefined) return modelId === '' ? '' : effort
  return reasoning.efforts?.includes(effort) === true ? effort : ''
}

/**
 * The copy explaining why the picker is in its current state. One lookup for
 * both editors, so the create dialog and the detail page never drift apart.
 */
export function reasoningHintKey(models: readonly ExecutionModelOption[], modelId: string): TaskBoardKey {
  if (modelId === '') return 'exec.reasoning.hint.pickModel'
  if (reasoningOfModel(models, modelId) === undefined) return 'exec.reasoning.hint.unknownModel'
  return reasoningPickerEnabled(models, modelId) ? 'exec.reasoning.hint.inherit' : 'exec.reasoning.hint.noEfforts'
}
