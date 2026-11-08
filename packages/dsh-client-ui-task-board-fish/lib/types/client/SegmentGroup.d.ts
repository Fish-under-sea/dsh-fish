/**
 * The family's segmented control: a quiet track whose options share one
 * highlight that slides to the pressed option, instead of each option fading
 * its own background out and the next one in. The settings fields' small
 * choices and the Web Extensions TAB strip both render through it, so the two
 * read as one control.
 *
 * The caller builds the option buttons and marks the pressed one with
 * `data-active`; the group measures that button after every render and writes
 * its box as four custom properties, and the stylesheet draws the highlight
 * there (`.segmentGroup[data-pill]::before`). Attribute and first placement
 * land in the same task, so the highlight appears in place and only later
 * changes slide. A ResizeObserver re-measures when the group or an option
 * changes size: a longer locale, a font arriving, a container growing, a
 * strip wrapping onto a second line.
 */
import { type HTMLAttributes, type ReactNode } from 'react';
/** Props of {@link SegmentGroup}: the track's own attributes and the option buttons. */
export interface SegmentGroupProps extends HTMLAttributes<HTMLDivElement> {
    /** The option buttons; the pressed one carries `data-active`. */
    children: ReactNode;
}
/**
 * Render a segmented track around the caller's option buttons.
 * @param props - the track's attributes (role, accessible name, key handler) and its options.
 * @returns the track.
 */
export declare function SegmentGroup(props: SegmentGroupProps): ReactNode;
