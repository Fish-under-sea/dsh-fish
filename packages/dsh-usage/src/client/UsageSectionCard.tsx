/**
 * The usage statistics settings section: three tabs (用量: today's usage,
 * balances, trend; 个人套餐: per-provider plan quota windows; Token 银行:
 * the whale-yuan voucher minted from the DeepSeek official family's usage)
 * plus a compact settings row. Data comes from the host's loopback-fenced
 * /api/dsh-usage/overview document; polling runs only while the section is
 * mounted and the tab is visible.
 * @module @fish-under-sea/dsh-usage/client/UsageSectionCard
 */

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { UsageStoreInstance } from './usage-store.ts'
import { t } from './locales.ts'
import styles from './usage.module.css'
import { isDeepSeekProviderRoute } from '../core/adapters.ts'
import { deepseekPeriodAt } from '../core/pricing.ts'
import { voucherData, officialPricingScenarios, drawVoucher, faceValue, formatDay, formatDenomination, loadVoucherArt } from './voucher.ts'
import type { ObservedSpendView, ProviderSnapshotView, UsageDayView, UsageOverviewView, UsageProviderSummary, UsageTokenTotals, UsageWindowSummary } from '../core/types.ts'

/** The settings fields this section edits (immediate-apply semantics). */
export interface UsageSettings {
  enabled?: boolean
  pollIntervalSec?: number
}

/** The registration-side face the section's slot entry injects. */
export interface UsageSectionFace {
  /** The section-local store (overview snapshot + lifecycle). */
  store: UsageStoreInstance
  /** Fetch one overview now. */
  poll: () => void
  /** Force a host probe cycle now (resolves with the fresh overview). */
  refresh: () => void
  /**
   * Fetch one retained local day (YYYY-MM-DD) from the host. The overview
   * only carries today plus the list of recorded days, so a day the user picks
   * is one small on-demand request.
   */
  loadDay: (date: string) => Promise<UsageDayView>
  /** The shared configuration form this section's settings row reads and writes. */
  settings: ConfigForm<UsageSettings>
}

export interface UsageSectionProps extends UsageSectionFace {
  /** Close the settings panel (the shell owns the open state). */
  close: () => void
}

/** Poll cadence while the section is open. */
const SECTION_POLL_MS = 10_000

/**
 * The Token bank's default window: the whole retained ledger. It is a select
 * value rather than a date, so it can never collide with a day key.
 */
const BANK_ALL_DAYS = 'all'

/** Compact token count: 12345 -> 12.3k, 1234567 -> 1.23M. */
export function formatTokens(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value < 1000) return String(value)
  if (value < 1_000_000) return trim(value / 1000) + 'k'
  if (value < 1_000_000_000) return trim(value / 1_000_000) + 'M'
  return trim(value / 1_000_000_000) + 'B'
}

function trim(value: number): string {
  return value >= 100 ? String(Math.round(value)) : value.toFixed(value >= 10 ? 1 : 2).replace(/\.?0+$/, '')
}

function formatTime(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString()
  } catch {
    return ''
  }
}

function formatClock(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

/** Formatted CNY spend estimate (the only priced currency today). */
function formatCost(cost: number): string {
  return '¥' + cost.toFixed(2)
}

function toneClass(percent: number): string {
  if (percent >= 90) return styles.barLow
  if (percent >= 70) return styles.barWarn
  return styles.barFill
}

/** A provider row backed by a configured credential (api key, env key, or OAuth grant). */
function isConfigured(provider: ProviderSnapshotView): boolean {
  // An older wire document without the credential field renders as before.
  return provider.credential !== 'none'
}

function TotalsRow(props: { totals: UsageTokenTotals }): ReactNode {
  const { totals } = props
  return (
    <div className={styles.statRow}>
      <div className={styles.stat}>
        <span className={styles.statValue}>{formatTokens(totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens + totals.outputTokens)}</span>
        <span className={styles.statLabel}>{t('usage.tokens.total')}</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statValue}>{formatTokens(totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens)}</span>
        <span className={styles.statLabel}>{t('usage.tokens.input')}</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statValue}>{formatTokens(totals.outputTokens)}</span>
        <span className={styles.statLabel}>{t('usage.tokens.output')}</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statValue}>{formatTokens(totals.cacheReadTokens)}</span>
        <span className={styles.statLabel}>{t('usage.tokens.cacheRead')}</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statValue}>{formatTokens(totals.cacheWriteTokens)}</span>
        <span className={styles.statLabel}>{t('usage.tokens.cacheWrite')}</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statValue}>{formatTokens(totals.calls)}</span>
        <span className={styles.statLabel}>{t('usage.calls', { n: totals.calls })}</span>
      </div>
    </div>
  )
}

function balanceLine(provider: ProviderSnapshotView): ReactNode {
  if (provider.balance !== undefined) {
    return <span className={styles.providerBalance}>{provider.balance.currency.toUpperCase() === 'CNY' ? '¥' : provider.balance.currency.toUpperCase() === 'USD' ? '$' : ''}{provider.balance.totalBalance}{provider.balance.currency.toUpperCase() !== 'CNY' && provider.balance.currency.toUpperCase() !== 'USD' ? ' ' + provider.balance.currency.toUpperCase() : ''}</span>
  }
  if (provider.credential === 'oauth') return <span className={styles.muted}>{t('usage.oauth')}</span>
  if (provider.credential === 'none') return <span className={styles.muted}>{t('usage.balance.noCredential')}</span>
  // balanceSupported === false is the origin gate: the adapter has a balance
  // endpoint but it belongs to another provider's account (issue #1688), so
  // the row says so instead of silently vanishing from the card.
  if (provider.balanceSupported === false) return <span className={styles.muted}>{t('usage.balance.unsupported')}</span>
  if (!provider.supported) return <span className={styles.muted}>{t('usage.balance.unsupported')}</span>
  return null
}

function ProviderRow(props: { provider: ProviderSnapshotView; current?: string }): ReactNode {
  const { provider, current } = props
  return (
    <div className={styles.providerRow} data-dsh-part="provider-row">
      <span className={styles.providerName}>
        {provider.displayName}
        {current === provider.provider && <span className={styles.currentBadge}>{t('usage.current')}</span>}
      </span>
      <span className={styles.providerTokens}>{balanceLine(provider)}</span>
    </div>
  )
}

/** One day the pickers selected, as its fetch progresses. */
interface DayLoad {
  status: 'loading' | 'ready' | 'error'
  /** The served day, once the host answered. */
  view?: UsageDayView
  /** Transport error message, on a failed load. */
  error?: string
}

/**
 * Fetch the day a picker selected, or stay idle for the default window. Today
 * never fetches: the overview already carries it live, so switching back to
 * today is instant and keeps counting with the poll. A superseded selection
 * never lands (the effect cancels), and a failed load reports its own message
 * instead of leaving the card on a stale day.
 */
function useDayView(loadDay: (date: string) => Promise<UsageDayView>, date: string | undefined, today: string | undefined): DayLoad | undefined {
  const [load, setLoad] = useState<DayLoad | undefined>(undefined)
  useEffect(() => {
    if (date === undefined || date === today) {
      setLoad((previous) => (previous === undefined ? previous : undefined))
      return undefined
    }
    let cancelled = false
    setLoad({ status: 'loading' })
    loadDay(date).then(
      (view) => { if (!cancelled) setLoad({ status: 'ready', view }) },
      (error: unknown) => { if (!cancelled) setLoad({ status: 'error', error: error instanceof Error ? error.message : String(error) }) },
    )
    return () => { cancelled = true }
  }, [date, today, loadDay])
  return load
}

/**
 * The day picker: today plus every retained day that recorded usage, newest
 * first (the host serves the list ascending). Without that list (an older host
 * document) no picker renders and the card stays on its default window.
 */
function DayPicker(props: {
  value: string
  options: string[]
  today: string
  /** An extra leading option; the Token bank passes its whole-ledger window. */
  leading?: { value: string; label: string }
  onSelect: (date: string) => void
  /** Namespaces the element id, so the two tabs keep one control each. */
  part: string
}): ReactNode {
  const { value, options, today, leading, onSelect, part } = props
  if (options.length === 0) return null
  return (
    <div className={styles.dayPicker}>
      <label className={styles.dayPickerLabel} htmlFor={'dsh-usage-day-' + part}>{t('usage.day.label')}</label>
      <select
        id={'dsh-usage-day-' + part}
        className={styles.daySelect}
        value={value}
        onChange={(event) => { onSelect(event.target.value) }}
      >
        {leading !== undefined && <option value={leading.value}>{leading.label}</option>}
        {options.map((date) => (
          <option key={date} value={date}>{date === today ? t('usage.day.today') : date}</option>
        ))}
      </select>
    </div>
  )
}

/** The section component; the slot merges the face into these props. */
export function UsageSectionCard(props: UsageSectionProps): ReactNode {
  const { store, poll, refresh, loadDay, settings } = props
  const ui = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const settingsSnapshot = settings.getSnapshot()
  const settingsValue = settingsSnapshot.value ?? {}
  const [tab, setTab] = useState<'usage' | 'plans' | 'bank'>('usage')
  // Undefined means "the default window of this tab": today on the usage tab,
  // the whole retained ledger in the Token bank. A date switches that tab to
  // one retained day instead.
  const [usageDay, setUsageDay] = useState<string | undefined>(undefined)
  const [bankDay, setBankDay] = useState<string | undefined>(undefined)
  const [refreshing, setRefreshing] = useState(false)
  // The enable checkbox writes through the shared form, so subscribing here
  // keeps the flag below live: the form republishes the Host's accepted value,
  // and the poll starts and stops with it instead of waiting for an unrelated
  // render.
  const [, bumpSettings] = useState(0)
  useEffect(() => settings.subscribe(() => bumpSettings((count) => count + 1)), [settings])
  const enabled = settingsValue.enabled ?? true

  // Poll while mounted, enabled and visible; the overview is cheap (no probes —
  // the host's own cycle owns those) so 10 s keeps balances fresh-ish between
  // manual refreshes.
  useEffect(() => {
    // A disabled plugin deregisters its host routes, so the poll must stop with
    // it; the section re-enables by writing the flag back through the checkbox.
    if (!enabled) return undefined
    poll()
    let timer: number | undefined
    const start = (): void => {
      if (timer === undefined && document.visibilityState === 'visible') timer = window.setInterval(poll, SECTION_POLL_MS)
    }
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        poll()
        start()
      } else if (timer !== undefined) {
        window.clearInterval(timer)
        timer = undefined
      }
    }
    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (timer !== undefined) window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [poll, enabled])

  const snapshot = ui.snapshot
  const todayDate = snapshot?.usage.today.date
  // Every retained day that recorded usage, newest first, plus today so the
  // default window is always one of the options even before it has usage.
  const dayOptions = snapshot === null
    ? []
    : [...new Set([todayDate, ...(snapshot.usage.availableDays ?? [])]
      .filter((date): date is string => date !== undefined))].sort().reverse()
  // A selection retention no longer holds falls back to the tab's default
  // window, so a picker can never keep displaying a day the host dropped.
  const usageSelection = usageDay !== undefined && dayOptions.includes(usageDay) ? usageDay : undefined
  const bankSelection = bankDay !== undefined && dayOptions.includes(bankDay) ? bankDay : undefined
  const selectedDay = usageSelection ?? todayDate
  const isToday = selectedDay === todayDate
  const usageDayLoad = useDayView(loadDay, usageSelection, todayDate)
  const bankDayLoad = useDayView(loadDay, bankSelection, todayDate)
  // A selected day rides its own fetch; the default windows ride the overview.
  const day = isToday ? snapshot?.usage.today : usageDayLoad?.view
  const bankDayView = bankSelection === undefined
    ? undefined
    : bankSelection === todayDate ? snapshot?.usage.today : bankDayLoad?.view
  const bankWindow = bankSelection === undefined
    ? snapshot?.usage.all ?? snapshot?.usage.range
    : bankDayView === undefined
      ? undefined
      : { from: bankDayView.date, to: bankDayView.date, totals: bankDayView.totals, providers: bankDayView.providers }

  const onRefresh = (): void => {
    setRefreshing(true)
    try {
      refresh()
    } finally {
      // The POST resolves through the next poll tick; unlock shortly either way.
      window.setTimeout(() => setRefreshing(false), 3000)
    }
  }

  // Disabled, failed and still-loading states keep the settings row mounted:
  // it owns the enable checkbox, so replacing the whole panel would leave the
  // user no way back from the UI.
  if (!enabled || ui.status === 'error' || snapshot === null) {
    return (
      <div className={styles.section} data-dsh-plugin="usage">
        <span className={styles.muted} data-dsh-part="status-line">
          {!enabled
            ? t('usage.disabled')
            : ui.status === 'error'
              ? t('usage.error', { error: ui.error ?? '' })
              : t('usage.loading')}
        </span>
        <SettingsRow settings={settings} snapshot={settingsSnapshot.status === 'ready' ? settingsSnapshot : undefined} value={settingsValue} />
      </div>
    )
  }

  const current = snapshot.current
  const currentProvider = snapshot.providers.find((provider) => provider.provider === current.provider)
  // Peak-period line: only when the official DeepSeek family is in play this
  // session (the current route, or spend recorded under one today). It
  // describes the pricing window now, so a past day's card drops it.
  const deepseekPeriod = deepseekPeriodAt(Date.now())
  const deepseekVisible = isToday && ((current.provider !== undefined && isDeepSeekProviderRoute(current.provider))
    || snapshot.usage.today.providers.some((row) => isDeepSeekProviderRoute(row.provider)))
  // Plans tab: only configured routes with a real coding-plan/subscription
  // adapter (planSupported; an older host without the flag falls back to "has
  // a plan fact"). Balance-only providers (DeepSeek, ZenMux, ...) and
  // unconfigured routes (credential 'none') never appear here.
  const planProviders = snapshot.providers.filter((provider) => isConfigured(provider) && (provider.planSupported === true || (provider.planSupported === undefined && provider.plan !== undefined)))

  return (
    <div className={styles.section} data-dsh-plugin="usage">
      <div className={styles.header} data-dsh-part="header">
        <span className={styles.currentProvider}>
          {currentProvider !== undefined
            ? `${currentProvider.displayName}${current.model !== undefined && current.model !== '' ? ' · ' + current.model : ''}`
            : t('usage.noData')}
        </span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={styles.muted}>{t('usage.updated', { time: formatTime(snapshot.updatedAt) })}</span>
          <button type="button" className={styles.refreshBtn} onClick={onRefresh} disabled={refreshing}>
            {refreshing ? t('usage.refreshing') : t('usage.refresh')}
          </button>
        </span>
      </div>

      <div className={styles.tabs} role="tablist" data-dsh-part="tabs">
        <button type="button" role="tab" aria-selected={tab === 'usage'} className={tab === 'usage' ? `${styles.tab} ${styles.tabActive}` : styles.tab} onClick={() => setTab('usage')}>
          {t('usage.tab.usage')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'plans'} className={tab === 'plans' ? `${styles.tab} ${styles.tabActive}` : styles.tab} onClick={() => setTab('plans')}>
          {t('usage.tab.plans')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'bank'} className={tab === 'bank' ? `${styles.tab} ${styles.tabActive}` : styles.tab} onClick={() => setTab('bank')}>
          {t('usage.tab.bank')}
        </button>
      </div>

      {tab === 'usage' && (
        <>
          <div className={styles.card} data-dsh-part="today-card">
            <span className={styles.cardTitle}>{isToday ? t('usage.today') : t('usage.day.title', { date: selectedDay ?? '' })}</span>
            <DayPicker
              part="usage"
              value={selectedDay ?? ''}
              options={dayOptions}
              today={todayDate ?? ''}
              onSelect={(date) => { setUsageDay(date === todayDate ? undefined : date) }}
            />
            {deepseekVisible && (
              <span className={styles.muted} data-dsh-part="peak-status">
                {t(deepseekPeriod.peak ? 'usage.peak.on' : 'usage.peak.off', { time: formatClock(deepseekPeriod.boundaryMs) })}
              </span>
            )}
            {usageDayLoad?.status === 'error'
              ? <span className={styles.errorLine}>{t('usage.day.error', { error: usageDayLoad.error ?? '' })}</span>
              : day === undefined
                ? <span className={styles.muted}>{t('usage.day.loading')}</span>
                : day.totals.calls === 0
                  ? <span className={styles.muted}>{isToday ? t('usage.noData') : t('usage.day.empty')}</span>
                  : <TotalsRow totals={day.totals} />}
            {(day?.totals.cost ?? 0) > 0 && (
              <div className={styles.providerRow} data-dsh-part="today-cost">
                <span className={styles.providerName}>{isToday ? t('usage.today.cost') : t('usage.day.cost')}</span>
                <span className={styles.providerTokens}>{formatCost(day?.totals.cost ?? 0)}</span>
              </div>
            )}
            {(day?.providers.length ?? 0) > 0 && (
              <div data-dsh-part="provider-list">
                {(day?.providers ?? []).map((row) => (
                  <div key={row.provider} className={styles.providerRow}>
                    <span className={styles.providerName}>
                      {snapshot.providers.find((provider) => provider.provider === row.provider)?.displayName ?? row.provider}
                      {current.provider === row.provider && <span className={styles.currentBadge}>{t('usage.current')}</span>}
                    </span>
                    <span className={styles.providerTokens}>{formatTokens(row.totals.inputTokens + row.totals.cacheReadTokens + row.totals.cacheWriteTokens + row.totals.outputTokens)} · {t('usage.calls', { n: row.totals.calls })}{row.totals.cost > 0 ? ` · ${formatCost(row.totals.cost)}` : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.card} data-dsh-part="balance-card">
            <span className={styles.cardTitle}>{t('usage.balance')}</span>
            {(() => {
              const configured = snapshot.providers.filter(isConfigured)
              // Include rows whose balance is deliberately not applicable
              // (another origin's endpoint): the row itself explains why, which
              // a single generic line cannot (#1688).
              const rows = configured.filter((provider) => provider.balanceSupported === true || provider.balanceSupported === false || (provider.balanceSupported === undefined && provider.supported))
              if (rows.length === 0) {
                return <span className={styles.muted}>{configured.length === 0 ? t('usage.balance.noneConfigured') : t('usage.balance.unsupported')}</span>
              }
              return rows.map((provider) => (
                <ProviderRow key={provider.provider} provider={provider} current={current.provider} />
              ))
            })()}
            {snapshot.providers.some((provider) => isConfigured(provider) && provider.error !== undefined) && (
              <span className={styles.errorLine}>
                {snapshot.providers.filter((provider) => isConfigured(provider) && provider.error !== undefined).map((provider) => `${provider.displayName}: ${t('usage.provider.error', { error: provider.error ?? '' })}`).join(t('usage.errorListSeparator'))}
              </span>
            )}
          </div>

          <RangeCard range={snapshot.usage.range} providers={snapshot.providers} currentProvider={current.provider} />

          <SettingsRow settings={settings} snapshot={settingsSnapshot.status === 'ready' ? settingsSnapshot : undefined} value={settingsValue} />
        </>
      )}

      {tab === 'plans' && (
        planProviders.length === 0
          ? <div className={styles.card}><span className={styles.muted}>{t('usage.plan.noneConfigured')}</span></div>
          : planProviders.map((provider) => <PlanCard key={provider.provider} provider={provider} current={current.provider} />)
      )}

      {tab === 'bank' && (
        <>
          <DayPicker
            part="bank"
            value={bankSelection ?? BANK_ALL_DAYS}
            options={dayOptions}
            today={todayDate ?? ''}
            leading={{ value: BANK_ALL_DAYS, label: t('usage.bank.windowAll') }}
            onSelect={(date) => { setBankDay(date === BANK_ALL_DAYS ? undefined : date) }}
          />
          <VoucherCard
            window={bankWindow}
            // The observed-spend watch accrues from its own first balance
            // reading, so it describes the whole window only: a single day's
            // voucher falls back to that day's fold-time estimate.
            observedSpend={bankSelection === undefined ? snapshot.usage.observedSpend : undefined}
            loading={bankSelection !== undefined && bankDayLoad?.status === 'loading'}
            {...(bankDayLoad?.status === 'error' ? { error: bankDayLoad.error ?? '' } : {})}
          />
        </>
      )}
    </div>
  )
}

/** How many model sub-bars render under one provider bar. */
const CHART_MODEL_CAP = 3

/**
 * The 近 30 天 card: horizontal bars per provider over the trend window,
 * each with its heaviest models as nested sub-bars. Window totals come from
 * the host's aggregated `usage.range` (an older host without it renders no
 * card instead of a wrong one).
 */
function RangeCard(props: { range?: UsageOverviewView['usage']['range']; providers: ProviderSnapshotView[]; currentProvider?: string }): ReactNode {
  const { range, providers, currentProvider } = props
  if (range === undefined) return null
  const grandTotal = range.totals.inputTokens + range.totals.outputTokens + range.totals.cacheReadTokens + range.totals.cacheWriteTokens
  const maxProvider = Math.max(1, ...range.providers.map((row) => totalOf(row.totals)))
  const nameOf = (id: string): string => providers.find((provider) => provider.provider === id)?.displayName ?? id
  return (
    <div className={styles.card} data-dsh-part="trend-card">
      <span className={styles.cardTitle}>{t('usage.trend')}</span>
      {range.providers.length === 0 || grandTotal === 0
        ? <span className={styles.muted}>{t('usage.noData')}</span>
        : <div className={styles.chart} data-dsh-part="usage-chart">
            {range.providers.map((row) => (
              <ChartProviderRow key={row.provider} row={row} name={nameOf(row.provider)} max={maxProvider} current={currentProvider === row.provider} />
            ))}
            <span className={styles.trendAxis}>
              <span>{range.from.slice(5)}</span>
              <span>{range.to.slice(5)}</span>
            </span>
          </div>}
    </div>
  )
}

function ChartProviderRow(props: { row: UsageProviderSummary; name: string; max: number; current: boolean }): ReactNode {
  const { row, name, max, current } = props
  const total = totalOf(row.totals)
  const maxModel = Math.max(1, ...row.models.slice(0, CHART_MODEL_CAP).map((model) => totalOf(model.totals)))
  return (
    <div className={styles.chartProvider}>
      <span className={styles.chartHead}>
        <span className={styles.providerName}>
          {name}
          {current && <span className={styles.currentBadge}>{t('usage.current')}</span>}
        </span>
        <span className={styles.chartTokens}>{formatTokens(total)} · {t('usage.calls', { n: row.totals.calls })}</span>
      </span>
      <span className={styles.chartBar}>
        <span className={styles.chartFill} style={{ width: `${Math.max(2, Math.round((total / max) * 100))}%` }} />
      </span>
      {row.models.slice(0, CHART_MODEL_CAP).map((model) => {
        const modelTotal = totalOf(model.totals)
        return (
          <span key={model.model} className={styles.chartModel} title={`${row.provider} · ${model.model}: ${formatTokens(modelTotal)}`}>
            <span className={styles.chartModelName}>{model.model}</span>
            <span className={styles.chartModelBar}>
              <span className={styles.chartModelFill} style={{ width: `${Math.max(3, Math.round((modelTotal / maxModel) * 100))}%` }} />
            </span>
            <span className={styles.chartTokens}>{formatTokens(modelTotal)}</span>
          </span>
        )
      })}
    </div>
  )
}

function totalOf(totals: UsageTokenTotals): number {
  return totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens + totals.outputTokens
}

/**
 * The Token 银行 card: the mint family's (DeepSeek official + MiMo)
 * retained-ledger usage minted onto the whale-yuan note at 1,000,000 tokens
 * per whale yuan. The window is the whole retained ledger by default (the
 * host's aggregate, falling back to the 30-day trend when an older host serves
 * no `all`) or the single day the user picked; the spend line prefers the
 * official balance watch (whole window only) and falls back to the fold-time
 * estimate, which only the priced family feeds; the artwork draw failure
 * degrades to an error line and never takes the section down.
 */
function VoucherCard(props: { window?: UsageWindowSummary; observedSpend?: ObservedSpendView; loading?: boolean; error?: string }): ReactNode {
  const { window: ledger, observedSpend, loading, error } = props
  const data = voucherData(ledger)
  /**
   * The hypothetical price-book scenarios: the official family's tokens
   * repriced twice at the current Flash book, once as if every call ran in
   * peak hours and once as if every call ran off-peak. Deliberately **not**
   * derived from `data.cost` (which is stamped at fold time by the period each
   * call actually ran in) — the whole point is a counterfactual the user can
   * compare against the observed spend above it.
   */
  const scenarios = officialPricingScenarios(ledger)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [drawError, setDrawError] = useState<string | undefined>(undefined)
  const dataKey = data === undefined ? '' : `${data.from}|${data.to}|${data.tokens}|${data.calls}|${data.cost}`

  useEffect(() => {
    if (data === undefined) return
    const voucher = data
    let cancelled = false
    loadVoucherArt().then((art) => {
      if (cancelled) return
      const canvas = canvasRef.current
      if (canvas !== null) {
        try {
          drawVoucher(canvas, art, voucher)
        } catch (error) {
          if (!cancelled) setDrawError(error instanceof Error ? error.message : String(error))
        }
      }
    }, (error) => {
      if (!cancelled) setDrawError(error instanceof Error ? error.message : String(error))
    })
    return () => {
      cancelled = true
    }
  // dataKey covers every field the draw and the buttons read.
  }, [dataKey])

  const onSave = (): void => {
    const canvas = canvasRef.current
    if (canvas === null || data === undefined) return
    canvas.toBlob((blob) => {
      if (blob === null) return
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `dsh-whale-voucher-${data.to}.png`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    }, 'image/png')
  }

  const shareSupported = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
  const onShare = (): void => {
    const canvas = canvasRef.current
    if (canvas === null || data === undefined || !shareSupported) return
    canvas.toBlob(async (blob) => {
      if (blob === null) return
      const file = new File([blob], `dsh-whale-voucher-${data.to}.png`, { type: 'image/png' })
      if (!navigator.canShare({ files: [file] })) return
      try {
        await navigator.share({ files: [file], title: t('usage.bank.title') })
      } catch {
        // A user-cancelled share sheet rejects; nothing to report.
      }
    }, 'image/png')
  }

  return (
    <div className={styles.card} data-dsh-part="bank-card">
      <span className={styles.cardTitle}>{t('usage.bank.title')}</span>
      {error !== undefined
        ? <span className={styles.errorLine}>{t('usage.day.error', { error })}</span>
        : loading === true
          ? <span className={styles.muted}>{t('usage.day.loading')}</span>
          : data === undefined
            ? <span className={styles.muted}>{t('usage.bank.noUsage')}</span>
            : <>
            <span className={styles.muted}>{t('usage.bank.hint')}</span>
            <div className={styles.voucherPreview} data-dsh-part="voucher-preview">
              <canvas ref={canvasRef} aria-label={t('usage.bank.title')} />
            </div>
            {drawError !== undefined && <span className={styles.errorLine}>{t('usage.bank.drawError', { error: drawError })}</span>}
            <div className={styles.providerRow}>
              <span className={styles.providerName}>{t('usage.bank.minted', { minted: formatDenomination(faceValue(data.tokens)), tokens: formatTokens(data.tokens) })}</span>
              <span className={styles.providerTokens}>{t('usage.calls', { n: data.calls })}</span>
            </div>
            <span className={styles.muted}>
              {observedSpend !== undefined
                ? t('usage.bank.spend.observed', { cost: observedSpend.cny.toFixed(2), since: formatDay(observedSpend.since) })
                : t('usage.bank.spend.estimated', { cost: data.cost.toFixed(2) })}
            </span>
            {scenarios !== undefined && (
              <span className={styles.muted} data-dsh-part="bank-scenario">
                {t('usage.bank.scenario', { peak: scenarios.peak.toFixed(2), offPeak: scenarios.offPeak.toFixed(2) })}
              </span>
            )}
            <span className={styles.muted}>{t('usage.bank.window', { from: data.from, to: data.to })}</span>
            <div className={styles.buttonRow}>
              <button type="button" className={styles.refreshBtn} onClick={onSave}>{t('usage.bank.save')}</button>
              {shareSupported && <button type="button" className={styles.refreshBtn} onClick={onShare}>{t('usage.bank.share')}</button>}
            </div>
          </>}
    </div>
  )
}

function PlanCard(props: { provider: ProviderSnapshotView; current?: string }): ReactNode {
  const { provider, current } = props
  return (
    <div className={`${styles.card} ${styles.planCard}`} data-dsh-part="plan-card">
      <div className={styles.planHead}>
        <span className={styles.planName}>
          {provider.displayName}
          {current === provider.provider && <span className={styles.currentBadge}>{t('usage.current')}</span>}
          {provider.plan?.planName !== undefined ? ` · ${provider.plan.planName}` : ''}
        </span>
      </div>
      {provider.error !== undefined && <span className={styles.errorLine}>{t('usage.provider.error', { error: provider.error })}</span>}
      {provider.credential === 'none' && provider.plan === undefined
        ? <span className={styles.muted}>{t('usage.balance.noCredential')}</span>
        : provider.plan === undefined || provider.plan.windows.length === 0
          ? <span className={styles.muted}>{t('usage.plan.noPlan')}</span>
          : provider.plan.windows.map((window) => (
            <div key={window.key} className={styles.windowRow} data-dsh-part="plan-window">
              <span className={styles.windowLabel}>
                <span>{window.name ?? t(`usage.plan.windows.${window.key}`)}</span>
                <span>{window.percent !== undefined ? `${window.percent >= 10 ? Math.round(window.percent) : window.percent.toFixed(1)}%` : ''}</span>
              </span>
              {window.percent !== undefined && (
                <span className={styles.bar}>
                  <span className={toneClass(window.percent)} style={{ width: `${Math.min(100, Math.max(0, window.percent))}%`, display: 'block' }} />
                </span>
              )}
              {window.resetsAt !== undefined && (
                <span className={styles.resetLine}>{t('usage.plan.reset', { date: new Date(window.resetsAt).toLocaleString() })}</span>
              )}
            </div>
          ))}
    </div>
  )
}

/**
 * The compact settings row. Both controls write through the shared form the
 * moment the user changes them, and the Host answers each write with a
 * boolean: a refused (or transport-failed) write is surfaced as a failed save,
 * because a value that did not land must never read as applied.
 */
function SettingsRow(props: {
  settings: UsageSectionProps['settings']
  snapshot?: ConfigFormSnapshot<UsageSettings>
  value: UsageSettings
}): ReactNode {
  const { settings, snapshot, value } = props
  const disabled = snapshot === undefined || !snapshot.writable
  const [failure, setFailure] = useState<string | undefined>(undefined)

  const write = (field: 'enabled' | 'pollIntervalSec', next: boolean | number): void => {
    setFailure(undefined)
    let answer: Promise<boolean>
    try {
      answer = settings.set(field, next)
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error))
      return
    }
    // false is the contract's refusal/skip answer (the Host rejected the value,
    // the entry is not writable, or the write was dropped); a rejecting
    // transport reports through the same failed-save surface.
    Promise.resolve(answer).then(
      (accepted) => { if (!accepted) setFailure('') },
      (error: unknown) => { setFailure(error instanceof Error ? error.message : String(error)) },
    )
  }

  return (
    <div className={styles.card} data-dsh-part="settings-row">
      <span className={styles.cardTitle}>{t('usage.config.title')}</span>
      <div className={styles.settingsGrid}>
        <label className={styles.settingItem}>
          <input
            type="checkbox"
            checked={value.enabled ?? true}
            disabled={disabled}
            onChange={(event) => { write('enabled', event.target.checked) }}
          />
          {t('usage.config.enabled')}
        </label>
        <label className={styles.settingItem}>
          {t('usage.config.pollIntervalSec')}
          <input
            type="number"
            min={30}
            max={3600}
            value={typeof value.pollIntervalSec === 'number' ? value.pollIntervalSec : 60}
            disabled={disabled}
            onChange={(event) => {
              const parsed = Number(event.target.value)
              if (Number.isFinite(parsed) && parsed >= 30 && parsed <= 3600) write('pollIntervalSec', Math.round(parsed))
            }}
          />
        </label>
      </div>
      {failure !== undefined && (
        <span className={styles.errorLine} role="status">
          {t('usage.config.saveFailed')}{failure === '' ? '' : ' - ' + failure}
        </span>
      )}
    </div>
  )
}
