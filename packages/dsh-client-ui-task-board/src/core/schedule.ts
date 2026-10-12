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
  minutes: ReadonlySet<number>
  hours: ReadonlySet<number>
  days: ReadonlySet<number>
  months: ReadonlySet<number>
  /** Weekdays 0-6, 0 = Sunday (input 7 normalized to 0). */
  weekdays: ReadonlySet<number>
  /** Whether the day-of-month field text starts with `*` (Vixie starred). */
  dayStarred: boolean
  /** Whether the weekday field text starts with `*` (Vixie starred). */
  weekdayStarred: boolean
}

/** Inclusive ranges per field, in cron order. */
const FIELD_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0, 59], // minutes
  [0, 23], // hours
  [1, 31], // days
  [1, 12], // months
  [0, 7], // weekdays (7 = Sunday, normalized below)
]

/** Fallback zone when the process reports no usable IANA zone. */
export const HOST_TIME_ZONE_FALLBACK = 'UTC'

/** IANA `Area/Location`, plus the bare `UTC` the platform reports. */
const IANA_ZONE = /^[A-Za-z][A-Za-z0-9_+.-]*(?:\/[A-Za-z0-9_+.-]+)+$/

/** One resolved wall-clock reading in some zone. */
export interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

/** Cached formatters: constructing an Intl formatter dominates the cost of a resolve. */
const FORMATTERS = new Map<string, Intl.DateTimeFormat>()

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = FORMATTERS.get(timeZone)
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    FORMATTERS.set(timeZone, formatter)
  }
  return formatter
}

/**
 * The wall-clock reading of one instant in an explicit zone. Reading through
 * Intl (rather than the process `Date` accessors) is what makes the result
 * independent of the Host's own TZ.
 * @param timeZone - explicit IANA zone.
 * @param epochMs - instant to read.
 * @returns the zone-local calendar and clock fields.
 */
export function partsInZone(timeZone: string, epochMs: number): ZonedParts {
  const fields: Record<string, string> = {}
  for (const part of zoneFormatter(timeZone).formatToParts(new Date(epochMs))) {
    if (part.type !== 'literal') fields[part.type] = part.value
  }
  return {
    year: Number(fields.year),
    month: Number(fields.month),
    day: Number(fields.day),
    hour: Number(fields.hour),
    minute: Number(fields.minute),
  }
}

/** The zone's UTC offset in effect at one instant, in milliseconds. */
function offsetAt(timeZone: string, epochMs: number): number {
  const parts = partsInZone(timeZone, epochMs)
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - epochMs
}

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
export function zonedEpoch(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number | undefined {
  const naive = Date.UTC(year, month - 1, day, hour, minute)
  const offsets = new Set([
    offsetAt(timeZone, naive - 86_400_000),
    offsetAt(timeZone, naive),
    offsetAt(timeZone, naive + 86_400_000),
  ])
  let earliest: number | undefined
  for (const offset of offsets) {
    const candidate = naive - offset
    const parts = partsInZone(timeZone, candidate)
    if (parts.year !== year || parts.month !== month || parts.day !== day) continue
    if (parts.hour !== hour || parts.minute !== minute) continue
    if (earliest === undefined || candidate < earliest) earliest = candidate
  }
  return earliest
}

/**
 * The Host process's IANA zone, used for schedules that store no zone of their
 * own (a ledger written before zones were persisted).
 * @returns a zone name Intl accepts, never empty.
 */
export function resolveHostTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return typeof zone === 'string' && zone !== '' ? zone : HOST_TIME_ZONE_FALLBACK
  } catch {
    return HOST_TIME_ZONE_FALLBACK
  }
}

/**
 * Whether a value names a zone this runtime can actually resolve. A stored
 * zone is trusted only after it round-trips through Intl, so a typo or a zone
 * that this ICU build does not know can never arm a schedule.
 * @param value - candidate zone name.
 * @returns true when the name is usable.
 */
export function isValidTimeZone(value: string): boolean {
  if (value.trim() !== value || value === '') return false
  if (value !== 'UTC' && !IANA_ZONE.test(value)) return false
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone !== undefined
  } catch {
    return false
  }
}

/**
 * Parse a 5-field cron expression.
 * @returns the match sets, or null when the expression is invalid.
 */
export function parseCron(expr: string): CronSchedule | null {
  const fields = expr.trim().split(/\s+/)
  if (fields.length !== 5) return null
  const sets: Set<number>[] = []
  for (let index = 0; index < 5; index++) {
    const [min, max] = FIELD_RANGES[index]
    const set = new Set<number>()
    if (!parseField(fields[index], min, max, set)) return null
    sets.push(set)
  }
  const weekdays = new Set<number>()
  for (const day of sets[4]) weekdays.add(day === 7 ? 0 : day)
  return {
    minutes: sets[0],
    hours: sets[1],
    days: sets[2],
    months: sets[3],
    weekdays,
    // Vixie selects the day branch from the field TEXT: only a field starting
    // with '*' is starred. A written-out range such as '1-31' is restricted and
    // still participates in the OR/AND choice.
    dayStarred: fields[2].startsWith('*'),
    weekdayStarred: fields[4].startsWith('*'),
  }
}

/** Whether the expression parses. */
export function isValidCron(expr: string): boolean {
  return parseCron(expr) !== null
}

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
export function nextRunAtMs(expr: string, fromMs: number, timeZone?: string): number | undefined {
  const schedule = parseCron(expr)
  if (schedule === null) return undefined
  if (!hasPossibleCalendarDay(schedule)) return undefined
  const zone = timeZone ?? resolveHostTimeZone()
  const start = partsInZone(zone, fromMs)
  const limitMs = fromMs + 5 * 366 * 24 * 60 * 60 * 1000

  const sortedMinutes = [...schedule.minutes].sort((a, b) => a - b)
  const sortedHours = [...schedule.hours].sort((a, b) => a - b)
  const sortedMonths = [...schedule.months].sort((a, b) => a - b)

  let year = start.year
  let month = start.month
  let day = start.day
  let hour = start.hour
  // Strictly after fromMs: the walk starts from the next minute.
  let minute = start.minute + 1

  while (Date.UTC(year, month - 1, 1) <= limitMs + 86_400_000) {
    for (const candidateMonth of sortedMonths) {
      if (candidateMonth < month) continue
      const daysInMonth = new Date(Date.UTC(year, candidateMonth, 0)).getUTCDate()
      const dayStart = candidateMonth === month ? day : 1
      for (let candidateDay = dayStart; candidateDay <= daysInMonth; candidateDay += 1) {
        if (!dayCandidate(schedule, year, candidateMonth, candidateDay)) continue
        const hourStart = candidateMonth === month && candidateDay === day ? hour : 0
        for (const candidateHour of sortedHours) {
          if (candidateHour < hourStart) continue
          const minuteStart = candidateMonth === month && candidateDay === day && candidateHour === hour ? minute : 0
          for (const candidateMinute of sortedMinutes) {
            if (candidateMinute < minuteStart) continue
            const time = zonedEpoch(zone, year, candidateMonth, candidateDay, candidateHour, candidateMinute)
            if (time === undefined) continue
            if (time <= fromMs) continue
            if (time > limitMs) return undefined
            return time
          }
        }
      }
    }
    year += 1
    month = 1
    day = 1
    hour = 0
    minute = 0
  }
  return undefined
}

/**
 * The Vixie day gate shared by the candidate walk. Both fields restricted is
 * OR; any other combination is AND, because a starred field matches every
 * value and so cannot widen the result.
 */
function dayCandidate(schedule: CronSchedule, year: number, month: number, day: number): boolean {
  const dayMatches = schedule.days.has(day)
  // Day of week is a property of the calendar date, so it is zone-independent.
  const weekdayMatches = schedule.weekdays.has(new Date(Date.UTC(year, month - 1, day)).getUTCDay())
  if (!schedule.dayStarred && !schedule.weekdayStarred) return dayMatches || weekdayMatches
  return dayMatches && weekdayMatches
}

/** Reject impossible month/day pairs without spending the multi-year scan. */
function hasPossibleCalendarDay(schedule: CronSchedule): boolean {
  if (schedule.dayStarred || !schedule.weekdayStarred) return true
  const maximumDay = new Map<number, number>([
    [1, 31], [2, 29], [3, 31], [4, 30], [5, 31], [6, 30],
    [7, 31], [8, 31], [9, 30], [10, 31], [11, 30], [12, 31],
  ])
  for (const month of schedule.months) {
    const maximum = maximumDay.get(month) ?? 0
    if ([...schedule.days].some(day => day <= maximum)) return true
  }
  return false
}

/** Parse one comma-list field into the match set. */
function parseField(field: string, min: number, max: number, out: Set<number>): boolean {
  if (field === '*') {
    for (let value = min; value <= max; value++) out.add(value)
    return true
  }
  for (const part of field.split(',')) {
    if (part === '') return false
    const [range, stepRaw] = part.split('/')
    let low: number
    let high: number
    if (range === '*') {
      low = min
      high = max
    } else if (range.includes('-')) {
      const [a, b] = range.split('-')
      if (a === '' || b === '' || !isDigits(a) || !isDigits(b)) return false
      low = Number(a)
      high = Number(b)
    } else if (isDigits(range)) {
      low = Number(range)
      // Standard cron: a bare value carrying a step runs from that value to the
      // field maximum (minutes 5/15 are 5,20,35,50), while a bare value alone is
      // exactly itself (#1493).
      high = stepRaw === undefined ? low : max
    } else {
      return false
    }
    if (low < min || high > max || low > high) return false
    const step = stepRaw === undefined ? 1 : isDigits(stepRaw) ? Number(stepRaw) : NaN
    if (!Number.isInteger(step) || step < 1) return false
    for (let value = low; value <= high; value += step) out.add(value)
  }
  return true
}

function isDigits(value: string): boolean {
  return /^\d+$/.test(value)
}
