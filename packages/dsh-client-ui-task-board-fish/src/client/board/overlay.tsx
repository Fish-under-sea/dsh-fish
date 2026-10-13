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
 * @module @fish-under-sea/dsh-client-ui-task-board-fish/client/board/overlay
 */
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'

/**
 * Exit duration in milliseconds. It matches `--dsh-tb-motion-close` in
 * `board.module.css`; under `prefers-reduced-motion` the stylesheet keeps the
 * same duration and drops only the spatial travel, so the unmount delay stays
 * valid for both motion settings.
 */
export const OVERLAY_EXIT_MS = 140

/** Lifecycle phase of one transient surface. */
export type OverlayPhase = 'open' | 'closing'

/** Presence of one transient surface. */
export interface OverlayPresence {
  /** Whether the surface should render at all (true through the exit leg). */
  mounted: boolean
  /** Which leg of the motion pair the surface is on. */
  phase: OverlayPhase
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
export function usePresence(open: boolean, exitMs: number = OVERLAY_EXIT_MS): OverlayPresence {
  const [presence, setPresence] = useState<OverlayPresence>(
    () => ({ mounted: open, phase: open ? 'open' : 'closing' }),
  )
  useEffect(() => {
    if (open) {
      setPresence(current => (current.mounted && current.phase === 'open' ? current : { mounted: true, phase: 'open' }))
      return
    }
    setPresence(current => (current.mounted ? { mounted: true, phase: 'closing' } : current))
    const timer = setTimeout(() => { setPresence({ mounted: false, phase: 'closing' }) }, exitMs)
    return () => { clearTimeout(timer) }
  }, [open, exitMs])
  return presence
}

/** Tab-order selector of the elements a modal surface hands focus to. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Open modal surfaces in mount order. Keyboard handling belongs to the last
 * entry only: the board nests modals (a confirm or an edit form above the task
 * detail), and without the stack one Escape press would close both layers.
 */
const MODAL_STACK: symbol[] = []

/** The surface that currently owns the keyboard, if any. */
function topMostDialog(): symbol | undefined {
  return MODAL_STACK[MODAL_STACK.length - 1]
}

/** The dialog's keyboard/focus handle. */
export interface DialogHandle<T extends HTMLElement> {
  /** Callback ref for the dialog element itself (it must accept focus). */
  attach: (node: T | null) => void
  /** Backdrop press handler: closes only on a press of the backdrop itself. */
  onMouseDown: (event: MouseEvent<HTMLElement>) => void
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
export function useDialog<T extends HTMLElement>(onClose: () => void, phase: OverlayPhase): DialogHandle<T> {
  const nodeRef = useRef<T | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const [attached, setAttached] = useState(false)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  // Identity in the document-wide stack of open surfaces (see MODAL_STACK).
  const [token] = useState(() => Symbol('board-dialog'))

  /** Callback ref: records the node and triggers the initial focus pass. */
  const attach = useCallback((node: T | null): void => {
    nodeRef.current = node
    setAttached(node !== null)
  }, [])

  // Focus enters the surface on its first attach; the element that opened it
  // is remembered and gets focus back when the surface unmounts, so a keyboard
  // user returns to the control they came from instead of to the document.
  //
  // A surface that already landed focus inside itself keeps it: React's own
  // `autoFocus` (the create form's title field) commits before this pass and
  // names the field the user actually starts on. Otherwise focus goes to the
  // surface itself, which announces the dialog and its accessible name; the
  // first Tab then reaches its first control.
  useEffect(() => {
    if (!attached) return
    const opener = document.activeElement
    openerRef.current = opener instanceof HTMLElement ? opener : null
    const node = nodeRef.current
    if (node === null) return
    if (opener instanceof HTMLElement && node.contains(opener)) return
    const target = node.querySelector<HTMLElement>('[data-dsh-autofocus]')
    ;(target ?? node).focus()
  }, [attached])

  useEffect(() => {
    MODAL_STACK.push(token)
    return () => {
      const index = MODAL_STACK.indexOf(token)
      if (index >= 0) MODAL_STACK.splice(index, 1)
      const restore = openerRef.current
      if (restore !== null && restore.isConnected) restore.focus()
    }
  }, [token])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      // Only the topmost surface answers: a modal opened from the detail view
      // must swallow Escape and Tab itself instead of closing both layers.
      if (topMostDialog() !== token) return
      if (event.key === 'Escape') {
        if (phase === 'closing') return
        event.stopPropagation()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const node = nodeRef.current
      if (node === null) return
      const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey) {
        if (active === first || active === node) {
          event.preventDefault()
          last.focus()
        }
        return
      }
      if (active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => { document.removeEventListener('keydown', onKeyDown, true) }
  }, [phase, token])

  const onMouseDown = useCallback((event: MouseEvent<HTMLElement>): void => {
    if (event.target === event.currentTarget) closeRef.current()
  }, [])

  return { attach, onMouseDown }
}
