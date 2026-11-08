/**
 * Reasoning-effort field: one picker shared by both execution-target editors
 * (the create dialog and the detail page), so the two never describe the same
 * capability differently. The levels are the ones the picked model's catalog
 * entry declares; an empty value is a real choice — "follow the model or Host
 * default" — and is the default state.
 *
 * A stored level the roster no longer lists (the model left the roster, or its
 * adapter changed) stays shown and labelled, but is not offered again, so the
 * field never silently shows a different value than the one the card will ask
 * for while the choosable set stays exactly the levels the model declares.
 */
import type { ExecutionModelOption } from '../../core/controller.ts'
import { t } from '../locales.ts'
import css from '../board.module.css'
import { reasoningEffortsFor, reasoningHintKey, reasoningPickerEnabled } from './model-options.ts'

/** The controlled reasoning-effort picker. */
export function ReasoningEffortField({ models, modelId, value, pending, onChange }: {
  /** The roster the picked model is looked up in. */
  models: readonly ExecutionModelOption[]
  /** The model this card pins; '' means "no pin". */
  modelId: string
  /** The selected effort; '' means "follow the model or Host default". */
  value: string
  /** Whether a mutation is in flight (the field locks with the rest of the form). */
  pending: boolean
  onChange: (next: string) => void
}) {
  const efforts = reasoningEffortsFor(models, modelId)
  const unlisted = value !== '' && !efforts.includes(value)
  return (
    <>
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('exec.reasoning')}</span>
        <select
          className={css.select}
          value={value}
          disabled={pending || !reasoningPickerEnabled(models, modelId)}
          onChange={event => { onChange(event.target.value) }}
        >
          <option value="">{t('exec.reasoning.inherit')}</option>
          {unlisted && <option value={value} disabled>{value}{t('exec.reasoning.unknown')}</option>}
          {efforts.map(effort => <option key={effort} value={effort}>{effort}</option>)}
        </select>
      </label>
      <p className={css.detailText}>{t(reasoningHintKey(models, modelId))}</p>
    </>
  )
}
