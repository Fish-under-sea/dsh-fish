/**
 * Clamped markdown body for the detail overlay: a long description or prompt
 * renders behind a max-height clamp with a fade into the dialog surface and
 * an expand toggle, so it no longer pushes the execution settings and the
 * execution history out of view. Content that fits the clamp renders
 * untouched — no toggle, no fade, no extra markup behaviour.
 */
import { useEffect, useRef, useState } from 'react'
import css from '../board.module.css'
import { t } from '../locales.ts'
import { TaskMarkdown } from './task-markdown.tsx'

/**
 * Clamp height used when the stylesheet is unavailable to the runtime (unit
 * tests). The rendered value lives on `.clampBody[data-clamped='true']` in
 * board.module.css and is read back through getComputedStyle, so the CSS
 * stays the single source of the geometry.
 */
const CLAMP_FALLBACK_PX = 160

export function ClampedMarkdown({ source }: { source: string }) {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const bodyRef = useRef<HTMLDivElement | null>(null)

  // A different text starts clamped again; the measure effect re-decides
  // whether the toggle is needed at all.
  useEffect(() => { setExpanded(false) }, [source])

  useEffect(() => {
    const node = bodyRef.current
    if (node === null) return
    const measure = (): void => {
      // While clamped the computed max-height is the clamp; while expanded it
      // is 'none' and the fallback keeps the toggle stable. scrollHeight is
      // the full content height in both states (overflow:hidden does not
      // truncate it), so one comparison covers both.
      const declared = Number.parseFloat(getComputedStyle(node).maxHeight)
      const clamp = Number.isFinite(declared) ? declared : CLAMP_FALLBACK_PX
      setOverflowing(node.scrollHeight > clamp + 1)
    }
    measure()
    // The overlay width follows the viewport, so a resize can cross the clamp
    // threshold without the text itself changing.
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => { observer.disconnect() }
  }, [source, expanded])

  const clamped = overflowing && !expanded
  return (
    <>
      <div ref={bodyRef} className={css.clampBody} data-clamped={clamped}>
        <TaskMarkdown source={source} />
      </div>
      {overflowing && (
        <button
          type="button"
          className={`${css.linkButton} ${css.clampToggle}`}
          aria-expanded={expanded}
          onClick={() => { setExpanded(!expanded) }}
        >
          {expanded ? t('detail.collapse') : t('detail.expand')}
        </button>
      )}
    </>
  )
}
