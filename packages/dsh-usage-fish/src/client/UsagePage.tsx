/**
 * The usage page's card chrome: the family settings card whose header holds
 * the plugin switch, and the display rows the body closes with.
 * @module @fish-under-sea/dsh-usage-fish/client/UsagePage
 */

import type { ReactNode } from 'react'
import { t } from './locales.ts'
import styles from './usage.module.css'
import { ChoiceField, PluginSettingsCard, ToggleSwitch, ValueField } from './PluginSettingsCard.tsx'
import { POLL_INTERVAL_RANGE, SPEND_CURRENCIES, type UsageSettingsCardFace, type UsageSettingsCardState } from './usage-settings-card.ts'

/**
 * The page's card: the plugin switch in the header, the statistics and the
 * display rows in the body. A switched-off plugin keeps only the header, whose
 * line says how to bring it back; a refused write keeps the body, so the
 * failure line under the rows stays readable.
 */
export function UsagePage(props: { card: UsageSettingsCardState; face: UsageSettingsCardFace; enabled: boolean; children: ReactNode }): ReactNode {
  const { card, face, enabled } = props
  return (
    <ul className={styles.sectionList} data-dsh-plugin="usage">
      <PluginSettingsCard
        t={t}
        titleKey="usage.title"
        titleId="settings-usage-title"
        descriptionKey={enabled ? 'usage.description' : 'usage.disabled'}
        headerAction={card.exposed
          ? (
            <ToggleSwitch
              labelledBy="settings-usage-title"
              checked={enabled}
              disabled={!card.writable}
              onChange={(next) => { face.edit('enabled', String(next)) }}
            />
          )
          : undefined}
        headerOnly={!enabled && !card.failed}
        state={card}
        alwaysOpen
        renderChildrenWhenNotExposed
        hideNotExposedNotice
        onSave={face.save}
        onDiscard={face.discard}
      >
        {props.children}
        {card.exposed ? <SettingsRows card={card} face={face} /> : null}
      </PluginSettingsCard>
    </ul>
  )
}

/**
 * The display rows under the statistics. Each control writes through the card
 * form: the currency pick at once, a typed number after a pause or on Enter.
 * The rate only matters while spend shows in dollars, so it appears then.
 */
function SettingsRows(props: { card: UsageSettingsCardState; face: UsageSettingsCardFace }): ReactNode {
  const { card, face } = props
  const fieldProps = {
    overriddenLabel: t('settings.overridden'),
    resetLabel: t('settings.reset'),
    invalidLabel: t('settings.invalidNumber'),
    disabled: !card.writable,
  }
  return (
    <section className={styles.settingsGroup} aria-labelledby="settings-usage-display-title" data-dsh-part="settings-rows">
      <h3 className={styles.groupTitle} id="settings-usage-display-title">{t('usage.config.title')}</h3>
      <ValueField
        id="settings-usage-poll-interval"
        label={t('usage.config.pollIntervalSec')}
        hint={t('usage.config.pollIntervalHint')}
        numeric
        range={POLL_INTERVAL_RANGE}
        {...fieldProps}
        {...card.pollIntervalSec}
        onEdit={(text) => { face.edit('pollIntervalSec', text) }}
        onReset={() => { face.resetField('pollIntervalSec') }}
      />
      <ChoiceField
        id="settings-usage-spend-currency"
        label={t('usage.config.spendCurrency')}
        hint={t('usage.config.spendCurrencyHint')}
        inheritLabel={t('settings.inherit')}
        presentation="segment"
        choices={SPEND_CURRENCIES.map(currency => ({ value: currency, label: currency }))}
        {...fieldProps}
        {...card.spendCurrency}
        onEdit={(text) => { face.edit('spendCurrency', text) }}
        onReset={() => { face.resetField('spendCurrency') }}
      />
      {card.spendCurrency.text === 'USD'
        ? (
          <ValueField
            id="settings-usage-cny-per-usd"
            label={t('usage.config.cnyPerUsd')}
            hint={t('usage.config.cnyPerUsdHint')}
            numeric
            {...fieldProps}
            {...card.cnyPerUsd}
            onEdit={(text) => { face.edit('cnyPerUsd', text) }}
            onReset={() => { face.resetField('cnyPerUsd') }}
          />
        )
        : null}
    </section>
  )
}
