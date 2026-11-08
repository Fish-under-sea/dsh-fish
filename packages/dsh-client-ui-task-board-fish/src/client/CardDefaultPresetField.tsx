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
import type { ExecutionPresetOption } from '../core/controller.ts'
import { inheritPresetLabel, presetChoiceRows } from './board/preset-label.ts'
import { t } from './locales.ts'
import type { FieldProps } from './PluginSettingsCard.tsx'
import css from './settings-card.module.css'

/** Props of the default-preset field: the shared field contract plus the roster. */
export interface CardDefaultPresetFieldProps extends FieldProps {
  /**
   * The deployment's agent-preset roster, or undefined while its runtime read
   * has not answered: an unread roster offers the inherit choice alone instead
   * of calling every stored pin "removed".
   */
  presets: readonly ExecutionPresetOption[] | undefined
}

/**
 * Render the default-preset select.
 * @param props - the field contract and the roster to list.
 * @returns the field.
 */
export function CardDefaultPresetField(props: CardDefaultPresetFieldProps) {
  const presets = props.presets
  const rows = presetChoiceRows(presets ?? [])
  // A stored pin the roster no longer serves stays visible and pickable: it is
  // what the board currently holds, so the control must show it rather than
  // silently reading as the inherit choice.
  const unlisted = props.text !== '' && presets !== undefined && !presets.some(preset => preset.id === props.text)
  return (
    <div className={css.field}>
      <div className={css.head}>
        <label className={css.label} htmlFor={props.id}>{props.label}</label>
        {props.overridden
          ? (
            <span className={css.badges}>
              <span className={css.badge}>{props.overriddenLabel}</span>
              <button
                type="button"
                className={css.reset}
                disabled={props.disabled}
                onClick={props.onReset}
              >
                {props.resetLabel}
              </button>
            </span>
          )
          : null}
      </div>
      <select
        id={props.id}
        className={css.select}
        value={props.text}
        disabled={props.disabled}
        aria-invalid={props.invalid || undefined}
        onChange={(event) => { props.onEdit(event.target.value) }}
      >
        <option value="">{inheritPresetLabel(presets ?? [])}</option>
        {unlisted ? <option value={props.text}>{props.text}{t('exec.mode.removed')}</option> : null}
        {rows.builtin.length > 0
          ? (
            <optgroup label={t('exec.mode.builtinGroup')}>
              {rows.builtin.map(row => (
                <option key={row.id} value={row.id} disabled={row.disabled}>{row.label}</option>
              ))}
            </optgroup>
          )
          : null}
        {rows.custom.length > 0
          ? (
            <optgroup label={t('exec.mode.customGroup')}>
              {rows.custom.map(row => (
                <option key={row.id} value={row.id} disabled={row.disabled}>{row.label}</option>
              ))}
            </optgroup>
          )
          : null}
      </select>
      <p className={props.invalid ? css.invalid : css.hint} title={props.hintTitle}>
        {props.invalid ? props.invalidLabel : props.hint}
      </p>
    </div>
  )
}
