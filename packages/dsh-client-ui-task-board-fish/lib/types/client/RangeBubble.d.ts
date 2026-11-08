/**
 * Coarse adjustment for a bounded number: resting the pointer on the control
 * (or moving focus into it) raises a small bubble holding a slider across the
 * field's whole range, so a large change is one drag instead of many presses
 * or a retyped value. The control itself stays the precise entry.
 *
 * The bubble belongs to the anchor's subtree, so moving from the control onto
 * the bubble never counts as leaving. It opens after a short rest and closes a
 * moment after the pointer and focus have both gone, so crossing the control
 * on the way elsewhere does not flash it. While a drag is in progress the
 * bubble stays put even if the pointer strays off it.
 *
 * Dragging reports each value through `onInput`, so the field shows it live;
 * releasing the thumb, or a key press on it, reports `onCommit` once. The
 * bubble opens on the side of the control that has room inside the nearest
 * scrolling ancestor, so a row near the top of a settings page does not hang
 * its bubble under the page edge.
 */
import { type ReactNode } from 'react';
/** Props of {@link RangeBubble}. */
export interface RangeBubbleProps {
    /** Lowest value the slider reaches. */
    min: number;
    /** Highest value the slider reaches. */
    max: number;
    /** Slider granularity. */
    step: number;
    /** Current value; a value outside the range parks the thumb at the nearer end. */
    value: number;
    /** Accessible name of the slider. */
    label: string;
    /** Disables the bubble along with the control. */
    disabled?: boolean;
    /** Each value while the thumb moves. */
    onInput: (value: number) => void;
    /** The value the thumb was released on, once per drag or key press. */
    onCommit: (value: number) => void;
    /** The precise control the bubble hangs off. */
    children: ReactNode;
}
/**
 * Render the control with its coarse-adjustment bubble.
 * @param props - the range, the value and the two report callbacks.
 * @returns the anchor holding the control and the bubble.
 */
export declare function RangeBubble(props: RangeBubbleProps): ReactNode;
