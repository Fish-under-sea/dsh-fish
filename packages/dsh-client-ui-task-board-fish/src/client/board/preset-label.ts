/**
 * Display-only labels for the agent-preset roster, shared by the task form and
 * the detail view.
 *
 * The deployment's four built-in presets (the `standard` / `ptc` / `minimal` /
 * `cordis` rows the shipped web-app bundle declares) carry no display name in
 * the registry roster, so a picker would list bare ids beside the user presets.
 * The map below only supplies names for those four; any other id — a renamed
 * built-in, a community preset, a user preset — falls back to the roster name
 * and then to the id, so this table can never hide or mislabel a preset.
 */
import type { ExecutionPresetOption } from '../../core/controller.ts'
import { t, type TaskBoardKey } from '../locales.ts'

/** Built-in preset id -> display-name key (display sugar only). */
const BUILTIN_PRESET_LABELS: Record<string, TaskBoardKey> = {
  standard: 'preset.builtin.standard',
  ptc: 'preset.builtin.ptc',
  minimal: 'preset.builtin.minimal',
  cordis: 'preset.builtin.cordis',
}

/** Whether one roster row is a shipped built-in preset. */
export function isBuiltinPreset(id: string): boolean {
  return BUILTIN_PRESET_LABELS[id] !== undefined
}

/** Display label of one preset row: built-in label, roster name, or raw id. */
export function presetLabel(preset: Pick<ExecutionPresetOption, 'id' | 'name'>): string {
  const builtin = BUILTIN_PRESET_LABELS[preset.id]
  if (builtin !== undefined && (preset.name ?? '').trim() === '') return t(builtin)
  return preset.name ?? preset.id
}

/**
 * Label of the empty ("inherit") choice: names the preset a run actually lands
 * on when the card pins nothing, which is the deployment default the roster
 * marks with `isDefault`.
 */
export function inheritPresetLabel(presets: readonly ExecutionPresetOption[]): string {
  const fallback = presets.find(preset => preset.isDefault)
  if (fallback === undefined) return t('exec.mode.inherit')
  return t('exec.mode.inheritWith', { preset: presetLabel(fallback) })
}

/** One preset row a picker renders: the stored id, its label, and whether it may be picked. */
export interface PresetChoiceRow {
  /** The value a pin stores. */
  id: string
  /** Display label, already carrying the default and unavailable suffixes. */
  label: string
  /** True when the preset cannot compose a session: the row is shown but not selectable. */
  disabled: boolean
}

/**
 * The picker rows of one roster, split into the built-in and the user presets.
 * Both pickers render these rows — the create dialog's mode select and the
 * settings card's default-preset field — so their wording and their
 * unavailable rows cannot drift apart.
 * @param presets - the roster options.
 * @returns one row list per group, in roster order.
 */
export function presetChoiceRows(presets: readonly ExecutionPresetOption[]): { builtin: PresetChoiceRow[]; custom: PresetChoiceRow[] } {
  const row = (preset: ExecutionPresetOption): PresetChoiceRow => ({
    id: preset.id,
    label: presetLabel(preset)
      + (preset.isDefault ? t('exec.mode.defaultSuffix') : '')
      + (preset.broken !== undefined ? t('exec.mode.brokenSuffix') : ''),
    disabled: preset.broken !== undefined,
  })
  return {
    builtin: presets.filter(preset => isBuiltinPreset(preset.id)).map(row),
    custom: presets.filter(preset => !isBuiltinPreset(preset.id)).map(row),
  }
}
