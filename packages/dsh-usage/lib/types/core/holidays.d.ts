/**
 * Chinese public-holiday dates, Beijing calendar days, as `YYYY-MM-DD`.
 *
 * The DeepSeek peak rule bills a public holiday off-peak in full, and the
 * State Council publishes these dates per year, so they cannot be derived
 * from a rule. This module is that data; `pricing.ts` keeps the arithmetic.
 *
 * Adjusted workdays are deliberately absent: the provider counts the
 * calendar day, so an adjusted Saturday or Sunday is off-peak exactly like
 * any other weekend and listing it would price it as peak.
 *
 * Source: the yearly schedules in bastengao/chinese-holidays-node
 * (`data/<year>.json`, MIT). Only the `holiday` entries are taken; that
 * package's runtime code (which fetches over the network) and its
 * dependencies are not vendored.
 *
 * Coverage ends at the newest year below. A year with no entry is priced as
 * if it had no holidays, which is the documented default of
 * {@link PublicHolidayCalendar} in `pricing.ts`.
 * @module @fish-under-sea/dsh-usage/core/holidays
 */
/** Public-holiday dates keyed by Beijing calendar year. */
export declare const CHINESE_PUBLIC_HOLIDAYS: Readonly<Record<string, readonly string[]>>;
/** The newest year this table covers; later years carry no entry. */
export declare const HOLIDAY_TABLE_LAST_YEAR = 2026;
