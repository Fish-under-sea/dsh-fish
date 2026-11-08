/**
 * The usage page's settings card: the plugin switch and the three display
 * rows, written through the family card form so a pick lands at once and a
 * typed value after a pause, exactly as the other Web Extensions pages do.
 * @module @fish-under-sea/dsh-usage-fish/client/usage-settings-card
 */

import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { CardForm, booleanField, choiceField, numberField, type CardActions, type CardShell, type FieldState } from './settings-form.ts'

/** The settings fields this page edits (the namespace's own schema). */
export interface UsageSettings {
  enabled?: boolean
  pollIntervalSec?: number
  /** Currency the spend figures are displayed in; the ledger stays CNY. */
  spendCurrency?: 'CNY' | 'USD'
  /** CNY per USD, consulted only while the display currency is USD. */
  cnyPerUsd?: number
}

/** The display currencies the spend figures offer. */
export const SPEND_CURRENCIES = ['CNY', 'USD'] as const

/** Bounds of the poll interval, mirroring the host schema; the slider walks them in steps of 10 s. */
export const POLL_INTERVAL_RANGE = { min: 30, max: 3600, step: 10 }

/** What the settings card renders. */
export interface UsageSettingsCardState extends CardShell {
  enabled: FieldState
  pollIntervalSec: FieldState
  spendCurrency: FieldState
  cnyPerUsd: FieldState
}

/** The card's snapshot and its form actions, as the section receives them. */
export interface UsageSettingsCardFace extends CardActions {
  store: SnapshotStore<UsageSettingsCardState>
}

/** Bridges the usage namespace onto the family card form for the plugin's lifetime. */
export class UsageSettingsCardController {
  private readonly form: CardForm<UsageSettings>
  private readonly store: SnapshotStore<UsageSettingsCardState>

  /** @param scope - the bound configuration form of the usage namespace. */
  constructor(scope: ConfigForm<UsageSettings>) {
    this.form = new CardForm(scope, [
      booleanField('enabled'),
      numberField('pollIntervalSec', { integer: true, min: POLL_INTERVAL_RANGE.min }),
      choiceField('spendCurrency', SPEND_CURRENCIES),
      numberField('cnyPerUsd', { min: 0.01 }),
    ])
    this.store = this.form.bind(() => ({
      ...this.form.shell(),
      enabled: this.form.field('enabled'),
      pollIntervalSec: this.form.field('pollIntervalSec'),
      spendCurrency: this.form.field('spendCurrency'),
      cnyPerUsd: this.form.field('cnyPerUsd'),
    }))
  }

  /** The face the section's slot entry injects. */
  inject(): UsageSettingsCardFace {
    return { store: this.store, ...this.form.actions() }
  }

  /** Release the form subscription; the plugin disposer calls this on teardown. */
  dispose(): void {
    this.form.dispose()
  }
}
