/**
 * Shared behavior of the board's transient surfaces (the task detail overlay
 * and every modal that opens above it).
 *
 * Two concerns live here because they are one contract:
 *
 * - `usePresence` keeps a surface mounted through its exit leg. The board's
 *   overlays are mounted by a boolean at the call site; the moment that
 *   boolean flips the node would vanish, so the enter animation had no
 *   reverse. Presence turns the boolean into `open` -> `closing` -> gone and
 *   paints the phase on the surface, which is what the CSS transition pair
 *   reads. Dimensions never change across the pair, so nothing around the
 *   overlay reflows.
 * - `useDialog` owns the keyboard and focus contract of a modal surface:
 *   focus moves into the dialog when it opens and returns to the control that
 *   opened it when it closes, Tab cycles inside it, and Escape asks the owner
 *   to close.
 *
 * @module @fish-under-sea/dsh-client-ui-task-board/client/board/overlay
 */
import { type MouseEvent } from 'react';
/**
 * Exit duration in milliseconds. It matches `--dsh-tb-motion-close` in
 * `board.module.css`; under `prefers-reduced-motion` the stylesheet keeps the
 * same duration and drops only the spatial travel, so the unmount delay stays
 * valid for both motion settings.
 */
export declare const OVERLAY_EXIT_MS = 140;
/** Lifecycle phase of one transient surface. */
export type OverlayPhase = 'open' | 'closing';
/** Presence of one transient surface. */
export interface OverlayPresence {
    /** Whether the surface should render at all (true through the exit leg). */
    mounted: boolean;
    /** Which leg of the motion pair the surface is on. */
    phase: OverlayPhase;
}
/**
 * Keep a surface mounted until its exit transition has run.
 *
 * `open=false` starts the exit leg immediately (the surface paints
 * `data-state="closing"`) and unmounts it one exit duration later. Re-opening
 * during the exit leg cancels the unmount, so a fast toggle never leaves a
 * half-faded surface behind.
 * @param open - the owner's mount request.
 * @param exitMs - exit duration; defaults to {@link OVERLAY_EXIT_MS}.
 * @returns the mount decision and the phase to paint.
 */
export declare function usePresence(open: boolean, exitMs?: number): OverlayPresence;
/** The dialog's keyboard/focus handle. */
export interface DialogHandle<T extends HTMLElement> {
    /** Callback ref for the dialog element itself (it must accept focus). */
    attach: (node: T | null) => void;
    /** Backdrop press handler: closes only on a press of the backdrop itself. */
    onMouseDown: (event: MouseEvent<HTMLElement>) => void;
}
/**
 * Bind a modal surface's keyboard and focus contract.
 *
 * Focus enters the dialog on mount (its first focusable control, or the dialog
 * itself) and returns to the control that opened it on unmount. Tab wraps
 * inside the dialog, and Escape asks the owner to close — but only while the
 * surface is on its enter leg, so a repeat press during the exit cannot queue
 * a second close.
 * @param onClose - the owner's close request.
 * @param phase - the surface's current motion phase.
 * @returns the ref to attach and the backdrop press handler.
 */
export declare function useDialog<T extends HTMLElement>(onClose: () => void, phase: OverlayPhase): DialogHandle<T>;
