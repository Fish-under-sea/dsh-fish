/**
 * The default-agent-preset picker of the settings card's new-card-defaults
 * topic.
 *
 * It renders the rows the create dialog's own mode picker renders — built-in
 * presets first, then user presets, each labelled with its default and
 * unavailable suffixes (board/preset-label.ts owns both) — and it renders a
 * preset that cannot compose a session as a row that is visible but NOT
 * selectable, so the board never stores a default no session could be composed
 * from.
 *
 * The shared ChoiceField cannot express that: its choices carry no disabled
 * state, and a stored pin the roster no longer serves would render as an empty
 * trigger rather than as the unavailable preset it is. Both need a native
 * `<select>` (the fallback the shared SelectField itself takes under an
 * appearance skin), styled with the settings card's own field classes so the
 * control stays a sibling of the fields beside it.
 */
import type { ExecutionPresetOption } from '../core/controller.ts';
import type { FieldProps } from './PluginSettingsCard.tsx';
/** Props of the default-preset field: the shared field contract plus the roster. */
export interface CardDefaultPresetFieldProps extends FieldProps {
    /**
     * The deployment's agent-preset roster, or undefined while its runtime read
     * has not answered: an unread roster offers the inherit choice alone instead
     * of calling every stored pin "removed".
     */
    presets: readonly ExecutionPresetOption[] | undefined;
}
/**
 * Render the default-preset select.
 * @param props - the field contract and the roster to list.
 * @returns the field.
 */
export declare function CardDefaultPresetField(props: CardDefaultPresetFieldProps): import("react").JSX.Element;
