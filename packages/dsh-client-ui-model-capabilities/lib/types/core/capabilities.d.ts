/**
 * Capability-declaration core: pure logic over the pi-ai settings document.
 *
 * The official `llm-pi-ai` settings namespace already carries every field a
 * custom model needs — `models[].input` (request modalities) and
 * `models[].reasoningEfforts` (selectable reasoning levels with their wire
 * spellings). The 0.1.6-alpha.2 Models page edits `models[].input` itself
 * (the shared `ModelInputTypes` control on the pi-ai model list), so this
 * module declares reasoning efforts only and treats every other field,
 * `input` included, as data to preserve. It reads a redacted namespace view,
 * drafts the per-model reasoning edits, validates them against the adapter's
 * own rules, and builds the single path op a save performs.
 *
 * Write granularity note: the settings `mutate` path-op walker only descends
 * plain objects (`applyPathOp` replaces arrays it meets mid-path), so a model
 * entry can only be addressed by writing the provider's whole `models` array
 * — the same whole-array override the official card performs on its first
 * edit. Unknown fields on each entry survive: drafts are structurally open.
 *
 * @module @fish-under-sea/dsh-client-ui-model-capabilities/core
 */
import type { JsonValue } from '@deepseek-ai/dsh-util-values';
/** The official adapter family this plugin extends (the card slot's key). */
export declare const PI_AI_SETTINGS_NAMESPACE = "llm-pi-ai";
/** Every thinking level a profile may declare, in escalation order. */
export type ModelThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
/** The levels a capability draft may toggle, in escalation order. */
export declare const THINKING_LEVELS: readonly ModelThinkingLevel[];
/** Selectable reasoning efforts: level -> wire spelling; `off` alone may be empty ("send nothing"). */
export type ReasoningEfforts = Partial<Record<ModelThinkingLevel, string | null>>;
/**
 * One model profile as the plugin drafts it. Fields this plugin does not edit
 * (id, name, input, contextWindow, maxTokens, compat, ...) are kept as-is so a
 * save never drops what the official card or a hand edit wrote.
 */
export interface ModelEntryDraft {
    /** Model id sent to the provider; the only required field. */
    id: string;
    /** `false` = declared non-reasoning; a dict = declared levels; absent = inherit. */
    reasoningEfforts?: false | ReasoningEfforts;
    [field: string]: unknown;
}
/** How one entry's reasoning disposition is drafted. */
export type EffortsMode = 'inherit' | 'none' | 'levels';
/**
 * Read the value at a settings path. Plain-object walk only; an absent or
 * non-object link yields undefined. (Mirrors the redacted view's shape, not
 * the host's op walker: reads never need array indexing because the whole
 * `models` array is one value.)
 */
export declare function readAt(section: unknown, path: readonly string[]): unknown;
/**
 * Coerce a stored `models` value into drafts. Returns undefined when the value
 * is not an array; entries without a non-empty string id are skipped (the
 * adapter refuses them anyway, and dropping them here keeps the editor
 * renderable). Unknown fields are preserved by reference.
 */
export declare function modelsArrayOf(value: unknown): ModelEntryDraft[] | undefined;
/** Classify one entry's reasoning disposition for the tri-state editor. */
export declare function effortsModeOf(entry: ModelEntryDraft): EffortsMode;
/**
 * Normalize one entry's declared levels to wire spellings, escalation order.
 * `off` normalizes null/empty to '' ("supported, send nothing"); every other
 * declared level keeps its wire spelling (empty normalizes to '', which
 * validation reports).
 */
export declare function declaredLevelsOf(entry: ModelEntryDraft): Array<{
    level: ModelThinkingLevel;
    wire: string;
}>;
/** Validation failure for one capability draft, phrased for the editor. */
export type CapabilitiesIssue = {
    kind: 'effortsOffOnly';
} | {
    kind: 'effortsWireMissing';
    level: ModelThinkingLevel;
};
/**
 * Validate one draft against the rules the pi-ai adapter enforces on apply
 * (an invalid write would be refused after the fact; this reports it before):
 * a levels dict must declare at least one level beyond `off`, and every
 * non-off level must name a non-empty wire spelling.
 */
export declare function validateEntry(entry: ModelEntryDraft): CapabilitiesIssue | undefined;
/**
 * Immutable draft update: set the reasoning disposition.
 * - `inherit` drops the field.
 * - `none` writes `false`.
 * - `levels` writes a dict; toggled levels keep a previously stored wire
 *   spelling, new ones default to the identity (the level name itself). An
 *   empty dict is invalid downstream, so a fresh switch materializes the
 *   common OpenAI-style preset (low/medium/high) instead of starting empty.
 */
export declare function withEffortsMode(entry: ModelEntryDraft, mode: EffortsMode, levels?: ReadonlyMap<ModelThinkingLevel, string>): ModelEntryDraft;
/** The common reasoning preset a fresh levels-mode editor starts from. */
export declare const COMMON_EFFORTS_PRESET: ReadonlyArray<readonly [ModelThinkingLevel, string]>;
/** Wire-spelling map of one entry's declared levels (editors toggle against this). */
export declare function levelsMapOf(entry: ModelEntryDraft): Map<ModelThinkingLevel, string>;
/**
 * Sanitize a draft for storage: drop keys whose value is undefined (JSON has
 * no undefined) and clone plain objects/arrays one level deep so later draft
 * edits cannot alias stored state. Unknown fields ride along untouched.
 */
export declare function sanitizeEntry(entry: ModelEntryDraft): Record<string, unknown>;
/** One settings path op (the wire shape the remote mutate takes). */
export interface SetPathOp {
    op: 'set';
    path: string[];
    value: JsonValue;
}
export interface UnsetPathOp {
    op: 'unset';
    path: string[];
}
export type PathOp = SetPathOp | UnsetPathOp;
/**
 * Build the single op a save performs: replace the provider's whole `models`
 * array. The empty path suffix works on a stored section that does not carry
 * the array yet — the walker creates the intermediate objects, and every
 * other profile field keeps inheriting from its layer.
 */
export declare function buildModelsOp(settingsPath: readonly string[], entries: readonly ModelEntryDraft[]): SetPathOp;
/** A saved-models summary chip description used by the collapsed row header. */
export declare function effortsSummaryOf(entry: ModelEntryDraft): {
    mode: EffortsMode;
    levels: readonly ModelThinkingLevel[];
};
