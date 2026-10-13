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
import type { ExecutionPresetOption } from '../../core/controller.ts';
/** Whether one roster row is a shipped built-in preset. */
export declare function isBuiltinPreset(id: string): boolean;
/** Display label of one preset row: built-in label, roster name, or raw id. */
export declare function presetLabel(preset: Pick<ExecutionPresetOption, 'id' | 'name'>): string;
/**
 * Label of the empty ("inherit") choice: names the preset a run actually lands
 * on when the card pins nothing, which is the deployment default the roster
 * marks with `isDefault`.
 */
export declare function inheritPresetLabel(presets: readonly ExecutionPresetOption[]): string;
