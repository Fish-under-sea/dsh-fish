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
import type { ExecutionModelOption } from '../../core/controller.ts';
import type { TaskBoardKey } from '../locales.ts';
/**
 * Normalize a `session/modelCatalog` reply into picker rows: one row per model
 * of every provider group, keyed by the qualified route an execution pins.
 * @param value - the raw catalog reply.
 * @returns the rows, empty when the reply is unreadable.
 */
export declare function modelOptionsFromCatalog(value: unknown): ExecutionModelOption[];
/**
 * Normalize the flat `llm/discoverModels` list into picker rows. That reply
 * names models only, so every row leaves the reasoning capability unknown.
 * @param value - the raw discovery list.
 * @returns the rows, empty when the list is unreadable.
 */
export declare function modelOptionsFromDiscoveredModels(value: unknown): ExecutionModelOption[];
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
export declare function modelDisplayLabel(model: ExecutionModelOption): string;
/**
 * The picker rows of a model roster: the qualified `provider/model` route as
 * the value a pin stores, and the shared display form as the label, so two
 * providers offering one model name stay distinguishable.
 * @param models - the roster rows.
 * @returns the choice rows, in roster order.
 */
export declare function modelChoiceRows(models: readonly ExecutionModelOption[]): Array<{
    value: string;
    label: string;
}>;
/**
 * The capability row the roster publishes for one model route.
 * @returns undefined when no model is pinned, or the roster does not describe
 * the pinned one — an unknown model is not the same as a model without
 * reasoning.
 */
export declare function reasoningOfModel(models: readonly ExecutionModelOption[], modelId: string): ExecutionModelOption['reasoning'] | undefined;
/**
 * The effort ids the picker offers for a model, in catalog order.
 * @returns an empty list when the model is unpinned, unknown, declares no
 * reasoning, or publishes no selectable level.
 */
export declare function reasoningEffortsFor(models: readonly ExecutionModelOption[], modelId: string): string[];
/** Whether the effort picker may be operated: a pinned model with declared, selectable levels. */
export declare function reasoningPickerEnabled(models: readonly ExecutionModelOption[], modelId: string): boolean;
/**
 * The effort to keep when the picked model changes. Only a model that declares
 * its levels can invalidate one: a model the roster cannot describe keeps the
 * stored value, because the roster has no grounds to call it invalid.
 * @param effort - the effort currently stored/selected ('' = follow the default).
 * @returns the effort to keep.
 */
export declare function reconcileReasoningEffort(models: readonly ExecutionModelOption[], modelId: string, effort: string): string;
/**
 * The copy explaining why the picker is in its current state. One lookup for
 * both editors, so the create dialog and the detail page never drift apart.
 */
export declare function reasoningHintKey(models: readonly ExecutionModelOption[], modelId: string): TaskBoardKey;
