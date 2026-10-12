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
import type { UsageTokenTotals } from './types.ts';
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
    isPublicHoliday(date: string): boolean;
}
/**
 * The default calendar: the published Chinese public-holiday table, so a holiday
 * weekday prices off-peak instead of over-reporting at the peak rate. A year the
 * table does not cover holds no dates and falls back to peak on weekdays, which
 * is the safe direction to be wrong in: the estimate reads high rather than low.
 */
export declare const CN_PUBLIC_HOLIDAYS: PublicHolidayCalendar;
/**
 * The DeepSeek billing period at `ms`, plus when it next flips. The clock is
 * Beijing time regardless of the host timezone (UTC+8 has no DST, so a fixed
 * shift is exact). `boundaryMs` is the instant the current period ends — the
 * window's close while peaking, the next window's open otherwise.
 */
export declare function deepseekPeriodAt(ms: number, calendar?: PublicHolidayCalendar): {
    peak: boolean;
    boundaryMs: number;
};
/** 按当前 Flash 表计算固定时段假设值，不改变历史实际计费。 */
export declare function deepseekFlashScenarioSpend(totals: Readonly<UsageTokenTotals>, column: 'peak' | 'offPeak'): number;
/**
 * Estimate one call's DeepSeek spend in CNY from its token totals, priced in
 * the billing period at `atMs`. Uncatalogued model ids take the flash-class
 * row; ids from other providers never reach this function (the service gates
 * by route family). Rounded to micro-CNY so the ledger stays readable.
 */
export declare function deepseekModelSpend(model: string, totals: Readonly<UsageTokenTotals>, atMs: number, calendar?: PublicHolidayCalendar): number;
