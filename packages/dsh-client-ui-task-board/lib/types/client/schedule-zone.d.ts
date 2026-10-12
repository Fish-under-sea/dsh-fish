import { type ScheduleRule, type ScheduleStopReason } from '../core/tasks.ts';
import { type TaskBoardKey } from './locales.ts';
/** One selectable zone, in the order the picker shows it. */
export interface ZoneChoice {
    /** Canonical IANA id, or `''` for the Host-zone entry. */
    id: string;
    /** Display label. */
    label: string;
}
/**
 * Zones offered by the picker: the Host zone first (the default, and the entry
 * a rule with no stored zone follows), then the runtime's own inventory.
 *
 * The Host entry is always present, even before the Host snapshot reports a
 * zone: it is the entry that stores no zone, so dropping it would leave a rule
 * unable to express "follow the Host" and would let the control silently
 * display an unrelated zone.
 *
 * A stored zone the inventory does not list (a rule written on another machine
 * or under a different ICU build) is appended, so opening the editor can never
 * silently rewrite the rule's zone.
 * @param hostTimeZone - zone the Host reported for this deployment, when known.
 * @param storedTimeZone - zone the edited rule already stores, when any.
 * @returns the de-duplicated choice list.
 */
export declare function zoneChoices(hostTimeZone: string | undefined, storedTimeZone?: string): ZoneChoice[];
/**
 * The relative half of a next-run label: how far away the instant is, or how
 * far past it the board is running. `now` is passed in rather than sampled so
 * callers can share one clock reading across a row, and tests stay
 * deterministic.
 * @param targetMs - the instant being described.
 * @param now - the reference instant.
 * @returns localized relative wording.
 */
export declare function relativeTimeLabel(targetMs: number, now: number): string;
/**
 * The `datetime-local` input value for an instant, read in an explicit zone:
 * `YYYY-MM-DDTHH:mm`. Uses the shared engine's zone reader, so the editor
 * shows the same wall clock the Host schedules by.
 * @param epochMs - the instant to render.
 * @param timeZone - zone to read it in; absent uses the Host zone.
 * @returns the input value.
 */
export declare function zonedInputValue(epochMs: number, timeZone?: string): string;
/**
 * Parse a `datetime-local` input value back to an instant, read in an explicit
 * zone. Returns undefined when the text is not a whole calendar wall clock or
 * names one the zone skips (a spring-forward gap), so the editor can refuse an
 * unusable instant instead of silently moving it.
 * @param value - the input text.
 * @param timeZone - zone to interpret it in; absent uses the Host zone.
 * @returns the instant, or undefined when it is not a usable wall clock.
 */
export declare function parseZonedInput(value: string, timeZone?: string): number | undefined;
/**
 * The default instant a new one-shot editor opens on: the next whole hour,
 * rendered in the zone the rule will be read in.
 * @param now - reference instant.
 * @param timeZone - zone the rule is read in.
 * @returns the input value for a near-future default.
 */
export declare function defaultZonedInputValue(now: number, timeZone?: string): string;
/**
 * The editor's run-cap option for a stored cap: the two named presets, the
 * unlimited entry, or a custom value the editor shows in its own field.
 * @param maxRuns - the stored cap, when any.
 * @returns the select option value.
 */
export declare function runCapOption(maxRuns: number | undefined): string;
/** The locale key describing why a rule stopped or skipped an occurrence. */
export declare function stopReasonKey(reason: ScheduleStopReason): TaskBoardKey;
/**
 * The run-budget line: how many scheduled executions the Host opened and how
 * many remain. Derived from the counter and the cap rather than stored, so the
 * display cannot drift from the ledger.
 * @param rule - the schedule rule.
 * @returns localized wording.
 */
export declare function budgetLabel(rule: ScheduleRule): string;
/** The line describing a rule that stopped itself, or undefined while it may still fire. */
export declare function endedLabel(rule: ScheduleRule): string | undefined;
/** The line describing the last skipped occurrence, or undefined when none. */
export declare function skippedLabel(rule: ScheduleRule): string | undefined;
/**
 * The full next-run label: the absolute wall clock in the schedule's own zone,
 * plus the relative distance in parentheses. Showing both matters because a
 * rule's zone can differ from the reader's, so the wall clock alone is
 * ambiguous and the distance alone loses the actual moment.
 * @param targetMs - the instant being described.
 * @param timeZone - zone to render the absolute half in.
 * @param formatAbsolute - formatter for the absolute half (keeps Intl caching in the caller).
 * @param now - the reference instant.
 * @param translate - translate function, bound so this module stays dependency-light.
 * @returns the combined label.
 */
export declare function nextRunLabel(targetMs: number, timeZone: string | undefined, formatAbsolute: (ms: number, timeZone?: string) => string, now: number): string;
