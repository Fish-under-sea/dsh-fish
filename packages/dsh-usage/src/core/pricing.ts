/**
 * DeepSeek official peak/off-peak pricing: the published price book plus the
 * peak-window clock, folded into a per-call spend estimate the ledger stamps
 * at fold time (the provider bills each request in the period the request ran
 * in, so pricing at the fold is the honest estimate).
 *
 * Policy (api-docs.deepseek.com pricing page): peak hours are Beijing time
 * Monday-Friday 09:00-12:00 and 14:00-18:00, excluding Chinese public
 * holidays; every other hour is off-peak and billed at half the peak price.
 * The published rule counts a calendar day, not the working schedule: a
 * Saturday or Sunday is off-peak in full even on an adjusted workday, and a
 * public holiday is off-peak in full even on a Monday-Friday. All prices
 * here are CNY per million tokens.
 *
 * Public-holiday dates are not derivable from the rule, so the rule takes them as
 * a `PublicHolidayCalendar`. The default is the published table in `./holidays.ts`,
 * covering 2020 through ${HOLIDAY_TABLE_LAST_YEAR}; a caller with newer dates
 * passes its own. A holiday weekday therefore prices off-peak, which is the half
 * of the published rule that is easy to get wrong.
 *
 * The published rows are `deepseek-flash` (DeepSeek-V4.1-Flash) and
 * `deepseek-v4-pro` (DeepSeek-V4-Pro-0813). The retired flash ids
 * (`deepseek-v4-flash`, `deepseek-v4-flash-vision-exp`) stay accepted and bill
 * at the flash row; DeepSeek routes `deepseek-v4-pro` to V4.1-Flash from the
 * retirement instant below until V4.1 Pro ships.
 * @module @fish-under-sea/dsh-usage/core/pricing
 */

import type { UsageTokenTotals } from './types.ts'
import { CHINESE_PUBLIC_HOLIDAYS, HOLIDAY_TABLE_LAST_YEAR } from './holidays.ts'

/** One peak window in minutes-of-day, Beijing time. */
interface PeakWindow {
  /** Inclusive start, minutes since midnight. */
  from: number
  /** Exclusive end, minutes since midnight. */
  to: number
}

/** The published peak windows: weekday 09:00-12:00 and 14:00-18:00. */
const PEAK_WINDOWS: readonly PeakWindow[] = [
  { from: 9 * 60, to: 12 * 60 },
  { from: 14 * 60, to: 18 * 60 },
]

/** Beijing is UTC+8 year-round (no DST), so a fixed shift is exact. */
const BEIJING_UTC_OFFSET_MS = 8 * 3_600_000

/** One price row in CNY per million tokens, split by billing period. */
interface ModelPrice {
  /** Input served from the provider prompt cache. */
  cacheHit: { offPeak: number; peak: number }
  /** Uncached input (DeepSeek reports no separate cache-write class). */
  inputMiss: { offPeak: number; peak: number }
  /** Output; reasoning tokens bill as output. */
  output: { offPeak: number; peak: number }
}

/** deepseek-flash (DeepSeek-V4.1-Flash), including the retired flash-class ids it now serves. */
const FLASH_PRICE: ModelPrice = {
  cacheHit: { offPeak: 0.02, peak: 0.04 },
  inputMiss: { offPeak: 1.0, peak: 2.0 },
  output: { offPeak: 4.0, peak: 8.0 },
}

/** deepseek-v4-pro (DeepSeek-V4-Pro-0813); superseded by the flash row at the retirement instant. */
const PRO_PRICE: ModelPrice = {
  cacheHit: { offPeak: 0.15, peak: 0.3 },
  inputMiss: { offPeak: 4.5, peak: 9.0 },
  output: { offPeak: 13.5, peak: 27.0 },
}

/**
 * The instant DeepSeek starts serving `deepseek-v4-pro` requests from
 * V4.1-Flash and billing the flash row: 2026-09-14 12:00 Beijing (UTC+8).
 * Drop the pro row's time fence once V4.1 Pro ships with a published row.
 */
const V4_PRO_FOLDED_INTO_FLASH_AT_MS = Date.UTC(2026, 8, 14, 4, 0)

function withinWindow(minuteOfDay: number): PeakWindow | undefined {
  return PEAK_WINDOWS.find((window) => minuteOfDay >= window.from && minuteOfDay < window.to)
}

/**
 * Supplies the Chinese public-holiday dates the peak rule excludes. The dates
 * are not derivable from any rule (the State Council publishes them per year),
 * so this repository ships no table of its own: the default calendar is empty,
 * and a caller that has real dates passes them in. A date is compared as a
 * Beijing-time `YYYY-MM-DD` string, which is the granularity the published
 * rule needs (a holiday is off-peak for the whole day, so times never matter).
 */
export interface PublicHolidayCalendar {
  /** True when the Beijing-time calendar day `date` is a Chinese public holiday. */
  isPublicHoliday(date: string): boolean
}

/**
 * The default calendar: the published Chinese public-holiday table, so a holiday
 * weekday prices off-peak instead of over-reporting at the peak rate. A year the
 * table does not cover holds no dates and falls back to peak on weekdays, which
 * is the safe direction to be wrong in: the estimate reads high rather than low.
 */
export const CN_PUBLIC_HOLIDAYS: PublicHolidayCalendar = {
  isPublicHoliday: (date) => {
    const year = date.slice(0, 4)
    if (Number(year) > HOLIDAY_TABLE_LAST_YEAR) return false
    return CHINESE_PUBLIC_HOLIDAYS[year]?.includes(date) ?? false
  },
}

/** The Beijing-time `YYYY-MM-DD` calendar day of `ms` (UTC+8 has no DST, so the shift is exact). */
function beijingDate(ms: number): string {
  const shifted = new Date(ms + BEIJING_UTC_OFFSET_MS)
  const month = `${shifted.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${shifted.getUTCDate()}`.padStart(2, '0')
  return `${shifted.getUTCFullYear()}-${month}-${day}`
}

/**
 * Whether `ms` falls on a peak-eligible Beijing day: Monday-Friday that is
 * not a public holiday. A Saturday or Sunday is never eligible, including on
 * an adjusted workday — the provider counts the calendar day, not the
 * working schedule.
 */
function isPeakDay(ms: number, calendar: PublicHolidayCalendar): boolean {
  const shifted = new Date(ms + BEIJING_UTC_OFFSET_MS)
  const weekday = shifted.getUTCDay()
  if (weekday < 1 || weekday > 5) return false
  return !calendar.isPublicHoliday(beijingDate(ms))
}

/**
 * The DeepSeek billing period at `ms`, plus when it next flips. The clock is
 * Beijing time regardless of the host timezone (UTC+8 has no DST, so a fixed
 * shift is exact). `boundaryMs` is the instant the current period ends — the
 * window's close while peaking, the next window's open otherwise.
 */
export function deepseekPeriodAt(ms: number, calendar: PublicHolidayCalendar = CN_PUBLIC_HOLIDAYS): { peak: boolean; boundaryMs: number } {
  const shifted = new Date(ms + BEIJING_UTC_OFFSET_MS)
  const minuteOfDay = shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
  const current = isPeakDay(ms, calendar) ? withinWindow(minuteOfDay) : undefined
  if (current !== undefined) {
    return { peak: true, boundaryMs: ms + (current.to - minuteOfDay) * 60_000 - shifted.getUTCSeconds() * 1000 - shifted.getUTCMilliseconds() }
  }
  // Next window start: later today (on a peak-eligible day), else the first
  // peak-eligible day's morning window; the scan bound makes a malformed clock
  // terminate.
  for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
    const dayStartMs = ms + dayOffset * 86_400_000
    if (!isPeakDay(dayStartMs, calendar)) continue
    const day = new Date(dayStartMs + BEIJING_UTC_OFFSET_MS)
    const realDayStart = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) - BEIJING_UTC_OFFSET_MS
    for (const window of PEAK_WINDOWS) {
      if (dayOffset === 0 && window.from <= minuteOfDay) continue
      return { peak: false, boundaryMs: realDayStart + window.from * 60_000 }
    }
  }
  // Unreachable (the scan covers a full week of peak-eligible days); a
  // conservative off-peak answer.
  return { peak: false, boundaryMs: ms + 86_400_000 }
}

/** The price row for a model id at `atMs`; unknown ids take the flash-class row (documented estimate). */
function priceFor(model: string, atMs: number): ModelPrice {
  const proPriced = model.includes('v4-pro') && atMs < V4_PRO_FOLDED_INTO_FLASH_AT_MS
  return proPriced ? PRO_PRICE : FLASH_PRICE
}

/** 按当前 Flash 表计算固定时段假设值，不改变历史实际计费。 */
export function deepseekFlashScenarioSpend(totals: Readonly<UsageTokenTotals>, column: 'peak' | 'offPeak'): number {
  return (totals.cacheReadTokens * FLASH_PRICE.cacheHit[column]
    + (totals.inputTokens + totals.cacheWriteTokens) * FLASH_PRICE.inputMiss[column]
    + totals.outputTokens * FLASH_PRICE.output[column]) / 1_000_000
}

/**
 * Estimate one call's DeepSeek spend in CNY from its token totals, priced in
 * the billing period at `atMs`. Uncatalogued model ids take the flash-class
 * row; ids from other providers never reach this function (the service gates
 * by route family). Rounded to micro-CNY so the ledger stays readable.
 */
export function deepseekModelSpend(model: string, totals: Readonly<UsageTokenTotals>, atMs: number, calendar: PublicHolidayCalendar = CN_PUBLIC_HOLIDAYS): number {
  const price = priceFor(model, atMs)
  const period = deepseekPeriodAt(atMs, calendar)
  const column = period.peak ? 'peak' : 'offPeak'
  const spend = (totals.cacheReadTokens * price.cacheHit[column]
    + (totals.inputTokens + totals.cacheWriteTokens) * price.inputMiss[column]
    + totals.outputTokens * price.output[column]) / 1_000_000
  return Math.round(spend * 1e6) / 1e6
}