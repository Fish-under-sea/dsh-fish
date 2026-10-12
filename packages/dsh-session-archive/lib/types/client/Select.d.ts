/**
 * Themed dropdown select for the section toolbar: a trigger button plus an
 * absolutely positioned listbox popup, replacing the unstyleable native
 * <select>. Keyboard complete (arrows, Home/End, Enter, Esc), closes on
 * outside pointer down, optional group headers render non-selectable.
 * @module @fish-under-sea/dsh-session-archive/client/Select
 */
import { type ReactNode } from 'react';
export interface SelectOption {
    value: string;
    label: string;
    /** Non-selectable group header this option renders under. */
    group?: string;
}
interface SelectProps {
    value: string;
    options: SelectOption[];
    ariaLabel: string;
    onChange: (value: string) => void;
}
export declare function Select(props: SelectProps): ReactNode;
export {};
