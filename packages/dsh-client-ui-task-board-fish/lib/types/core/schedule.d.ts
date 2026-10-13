/**
 * Zone-aware 5-field cron parsing and next-run computation for scheduled task
 * runs. Framework-free and dependency-free (Intl only) so the Host scheduler
 * and the browser next-run preview share one tiny pure module.
 *
 * Grammar: five whitespace-separated fields, 分 时 日 月 周. Every field
 * supports the wildcard, step (wildcard or range + "/n"), single value,
 * inclusive range a-b, and comma lists mixing any of those. Ranges: minutes
 * 0-59, hours 0-23, days 1-31, months 1-12, weekdays 0-7 (0 and 7 both mean
 * Sunday). Invalid expressions parse to null and are rejected by the UI and
 * the Host.
 *
 * Day semantics follow Vixie cron: a field is *starred* when its field text
 * starts with `*`. When day-of-month and day-of-week are both restricted the
 * fields combine with OR; otherwise they combine with AND. The distinction
 * matters for a stepped star such as `*&#47;2`, which still restricts the dates it
 * matches, so `0 0 *&#47;2 * 1` means "the Mondays that fall on an even day of
 * month" rather than "every even day, or every Monday".
 *
 * Time zone: every candidate wall clock is interpreted in an explicit IANA
 * zone (the schedule's stored zone, or the Host zone when none is given).
 * A wall clock that does not exist (spring-forward gap) is skipped, and an
 * ambiguous wall clock (fall-back overlap) resolves to the earlier instant, so
 * a repeated local minute fires exactly once. The Host-scheduler semantics are
 * byte-identical to `@deepseek-ai/dsh-schedule`'s resolver, which was verified
 * against it across twelve IANA zones (including 30-minute and 45-minute DST
 * offsets and a date-line jump) and 300k decision instants.
 *
 * That upstream is on the experimental track and is NOT a dependency here (no
 * import, no inject, no peer range), so a change to it fails no test. Re-run the
 * differential check on any `dsh-schedule` release or cohort bump that moves it,
 * and keep this comment honest; the re-verification trigger is recorded in
 * [the owning Agent Note](../../../../.agents/notes/implemented/feature/2026-09-29-task-board-schedule-time-zone.md).
 */
/** The parsed match sets of one cron expression. */
export interface CronSchedule {
    minutes: ReadonlySet<number>;
    hours: ReadonlySet<number>;
    days: ReadonlySet<number>;
    months: ReadonlySet<number>;
    /** Weekdays 0-6, 0 = Sunday (input 7 normalized to 0). */
    weekdays: ReadonlySet<number>;
    /** Whether the day-of-month field text starts with `*` (Vixie starred). */
    dayStarred: boolean;
    /** Whether the weekday field text starts with `*` (Vixie starred). */
    weekdayStarred: boolean;
}
/** Fallback zone when the process reports no usable IANA zone. */
export declare const HOST_TIME_ZONE_FALLBACK = "UTC";
/** One resolved wall-clock reading in some zone. */
export interface ZonedParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
}
/**
 * The wall-clock reading of one instant in an explicit zone. Reading through
 * Intl (rather than the process `Date` accessors) is what makes the result
 * independent of the Host's own TZ.
 * @param timeZone - explicit IANA zone.
 * @param epochMs - instant to read.
 * @returns the zone-local calendar and clock fields.
 */
export declare function partsInZone(timeZone: string, epochMs: number): ZonedParts;
/**
 * Resolve a wall clock in an explicit zone to its instant.
 *
 * The offset is probed a day either side of the naive guess so both DST
 * transitions are covered, then every candidate offset whose inverse maps back
 * to the requested wall clock is kept. No survivor means the wall clock does
 * not exist (a spring-forward gap); several means it is ambiguous (a fall-back
 * overlap), and the earliest instant wins so the repeated clock is taken once.
 * @param timeZone - explicit IANA zone.
 * @param year - full calendar year.
 * @param month - 1-12.
 * @param day - day of month.
 * @param hour - 0-23.
 * @param minute - 0-59.
 * @returns the instant in ms epoch, or undefined when the wall clock is skipped.
 */
export declare function zonedEpoch(timeZone: string, year: number, month: number, day: number, hour: number, minute: number): number | undefined;
/**
 * The Host process's IANA zone, used for schedules that store no zone of their
 * own (a ledger written before zones were persisted).
 * @returns a zone name Intl accepts, never empty.
 */
export declare function resolveHostTimeZone(): string;
/**
 * Whether a value names a zone this runtime can actually resolve. A stored
 * zone is trusted only after it round-trips through Intl, so a typo or a zone
 * that this ICU build does not know can never arm a schedule.
 * @param value - candidate zone name.
 * @returns true when the name is usable.
 */
export declare function isValidTimeZone(value: string): boolean;
/**
 * Parse a 5-field cron expression.
 * @returns the match sets, or null when the expression is invalid.
 */
export declare function parseCron(expr: string): CronSchedule | null;
/** Whether the expression parses. */
export declare function isValidCron(expr: string): boolean;
/**
 * Compute the next matching instant after `fromMs` strictly greater than it,
 * interpreting the expression's wall clock in `timeZone` (the Host zone when
 * omitted). Returns the ms epoch of the matching minute's start, or undefined
 * when the calendar constraint can never match (for example `0 0 30 2 *`).
 * The five-year horizon includes a full leap cycle, so a valid February 29
 * schedule remains reachable from every non-leap year.
 *
 * Walks candidate year/month/day/hour/minute values straight from the parsed
 * field sets instead of scanning every minute: a sparse expression such as
 * `0 0 29 2 *` used to iterate ~1.5M wall-clock minutes before reaching the
 * next leap day. A candidate wall clock that the zone skips (spring-forward
 * gap) is passed over, which is what makes the gap semantics fall out of the
 * candidate walk rather than needing a separate rule.
 * @param expr - 5-field cron expression.
 * @param fromMs - exclusive lower bound, ms epoch.
 * @param timeZone - explicit IANA zone; defaults to the Host zone.
 * @returns the next trigger instant, or undefined when unreachable.
 */
export declare function nextRunAtMs(expr: string, fromMs: number, timeZone?: string): number | undefined;
