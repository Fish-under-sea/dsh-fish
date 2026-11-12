/**
 * The reasoning-effort slider contributed to the OFFICIAL composer model
 * menu. The official seat keeps its own trigger — the "model · effort" display
 * at the composer's bottom-right stays untouched — and this slider is mounted
 * by the DOM injector inside the seat's open menu (the popover is the part the
 * plugin is allowed to change).
 *
 * 视觉移植自 HanaAyane/dsh-reasoning-effort PR 9（MIT）：默认使用八家模型
 * 对应的奔跑小人、深浅色滑块与辐射特效，保留本插件的会话选择契约。
 *
 * The control follows DSH's own session model-selection contract: the shared
 * per-session directory supplies the current route and its adapter-owned
 * effort metadata, and selecting a level submits the complete selection the
 * same way the official list rows do, so both surfaces stay in sync.
 *
 * @module dsh-better-reasoning-effort/client/ComposerSlider
 */
import { createElement, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { selectRefusalMessage } from './effort-memory.js'
import { detectModelTheme } from './model-theme.js'
import { drawRadiation } from './radiation.js'
import type { RadiationState } from './radiation.js'
import type {
  DirectoryCurrentLike,
  DirectoryGroupLike,
  EffortLevelLike,
  ModelDirectoryLike,
  ModelDirectoryStateLike,
} from './types.js'

/** Whether the model exposes at least two effort levels (a slider is meaningful only then). */
export function sliderLevels(state: ModelDirectoryStateLike): readonly EffortLevelLike[] {
  if (state.current === null) return []
  const group = state.groups.find(candidate => candidate.id === state.current?.provider)
  const model = group?.models.find(candidate => candidate.id === state.current?.model)
  const efforts = model?.reasoning?.efforts
  return efforts !== undefined && efforts.length >= 2 ? efforts : []
}

/** The current model of a directory snapshot. */
export function currentModelOf(state: ModelDirectoryStateLike): DirectoryCurrentLike | null {
  return state.current
}

/**
 * Level index the slider should rest at: the session's current effort when
 * the model still offers it, else the adapter default, else the middle level.
 */
export function effectiveEffortIndex(
  levels: readonly EffortLevelLike[],
  state: ModelDirectoryStateLike,
): number {
  const model = currentModelOf(state)
  const current = levels.findIndex(level => level.id === model?.reasoningEffort)
  if (current >= 0) return current
  const group = state.groups.find(candidate => candidate.id === model?.provider)
  const fallback = group?.models.find(candidate => candidate.id === model?.model)
    ?.reasoning?.defaultEffort
  const at = fallback === undefined ? -1 : levels.findIndex(level => level.id === fallback)
  if (at >= 0) return at
  return Math.floor((levels.length - 1) / 2)
}

/** Props of {@link ComposerSlider}. */
export interface ComposerSliderProps {
  /** The session's shared model directory (load + select ride the official seam). */
  directory: ModelDirectoryLike
  /** Localized copy (the plugin's bound translator). */
  t: (key: string, params?: Record<string, string | number>) => string
  /** Open the official model list (upstream's row function); injected by the mount. */
  pickModel?: () => void
}

/**
 * Render the upstream visual slider for the current model. The draft index is
 * held locally so dragging never flickers against the store; the commit
 * travels through {@link ModelDirectoryLike.select} (optimistic, rolled back
 * on refusal).
 */
export function ComposerSlider(props: ComposerSliderProps): ReactNode {
  const { directory, t } = props
  const state = useSyncExternalStore(
    (notify: () => void) => directory.store.subscribe(notify),
    () => directory.store.getSnapshot(),
  )
  const currentChoice = state.groups.find(group => group.id === state.current?.provider)
    ?.models.find(model => model.id === state.current?.model)
  const theme = detectModelTheme(state.current?.provider, state.current?.model, currentChoice?.name)
  const themeRef = useRef(theme)
  themeRef.current = theme
  const levels = sliderLevels(state)
  const [effort, setEffort] = useState('')
  const [preview, setPreview] = useState(0)
  const [committing, setCommitting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const committedRef = useRef('')
  const committingRef = useRef(false)
  const previewRef = useRef(0)
  const draggingRef = useRef(false)
  const pointerActiveRef = useRef(false)
  const activePointerIdRef = useRef<number | null>(null)
  const globalPointerMoveRef = useRef<((event: PointerEvent) => void) | null>(null)
  const globalPointerEndRef = useRef<((event: PointerEvent) => void) | null>(null)
  const globalPointerCancelRef = useRef<((event: PointerEvent) => void) | null>(null)
  const radiationRef = useRef<RadiationState>({ progress: 0.5, dragging: false })
  const redrawRef = useRef<(() => void) | null>(null)
  const available = state.current !== null && levels.length >= 2
  const busy = committing || state.status === 'selecting'
  const error = localError ?? state.error

  useEffect(() => {
    if (!available || committingRef.current || draggingRef.current) return
    const index = effectiveEffortIndex(levels, state)
    const next = levels[index]?.id ?? ''
    committedRef.current = next
    previewRef.current = index
    setEffort(next)
    setPreview(index)
    setLocalError(null)
  }, [available, levels, state])

  useEffect(() => {
    directory.load().catch(() => undefined)
  }, [directory])

  useEffect(() => {
    previewRef.current = preview
    radiationRef.current.progress = levels.length >= 2 ? preview / (levels.length - 1) : 0.5
    redrawRef.current?.()
  }, [preview, levels.length])

  useEffect(() => {
    radiationRef.current.dragging = dragging
    redrawRef.current?.()
  }, [dragging])

  useEffect(() => {
    redrawRef.current?.()
  }, [theme])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const context = canvas.getContext('2d')
    if (context === null) return

    // jsdom exposes none of these; degradation mirrors the reduced-motion
    // path (a static draw) so the component stays testable.
    const mq = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : undefined
    const reducedMotion = mq ?? { matches: false }
    let width = 1
    let height = 1
    let frame = 0

    const resize = (): void => {
      const bounds = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(1, bounds.width)
      height = Math.max(1, bounds.height)
      canvas.width = Math.max(1, Math.round(width * ratio))
      canvas.height = Math.max(1, Math.round(height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const draw = (time = performance.now()): void => {
      drawRadiation(context, width, height, time, radiationRef.current, themeRef.current)
    }

    const loop = (time: number): void => {
      draw(time)
      frame = window.requestAnimationFrame(loop)
    }

    const redraw = (): void => {
      if (reducedMotion.matches) draw()
    }

    let resizeObserver: ResizeObserver | undefined
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(() => {
        resize()
        draw()
      })
      resizeObserver.observe(canvas)
    }
    const themeObserver = new MutationObserver(() => draw())
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
    redrawRef.current = redraw
    resize()
    draw()
    if (!reducedMotion.matches && typeof window.requestAnimationFrame === 'function') {
      frame = window.requestAnimationFrame(loop)
    }

    return () => {
      if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      themeObserver.disconnect()
      redrawRef.current = null
    }
  }, [available])

  const effortIndex = (levels: readonly EffortLevelLike[], id: string | undefined): number => {
    return levels.findIndex((level) => level.id === id)
  }

  /** Snap pointer/range coordinates to the advertised discrete effort stops. */
  const snapIndex = (value: number, count: number): number =>
    Math.max(0, Math.min(count - 1, Math.round(value)))

  const rollback = useCallback((): void => {
    const previous = committedRef.current
    previewRef.current = Math.max(0, effortIndex(levels, previous))
    pointerActiveRef.current = false
    activePointerIdRef.current = null
    draggingRef.current = false
    setEffort(previous)
    setPreview(Math.max(0, effortIndex(levels, previous)))
    setDragging(false)
  }, [levels])

  const commit = useCallback(async (raw: number): Promise<void> => {
    if (committingRef.current) return
    committingRef.current = true
    const previous = committedRef.current

    // Hand focus to the menu BEFORE the busy state disables the input: a
    // disabled focused input drops focus onto <body>, and the official shell
    // closes the menu on a blur that leaves the card — the snap-shut every
    // commit shipped with (issue #13). Same handoff as the pane switch.
    const menu = inputRef.current?.closest<HTMLElement>('[role="menu"]')
    if (menu !== null && menu !== undefined) {
      menu.tabIndex = -1
      menu.focus({ preventScroll: true })
    }

    setDragging(false)
    setCommitting(true)
    setLocalError(null)

    // Optimistic snap from the rendered levels keeps the thumb responsive.
    // The commit runs against the LIVE snapshot's levels on purpose: the old
    // re-load here swung the shared catalog into its loading state on every
    // pick (the open menu visually collapsed on slow third-party catalogs),
    // and the official entry re-runs that load on every menu open anyway, so
    // the levels this slider rendered are already the fresh ones.
    const index = snapIndex(raw, levels.length)
    const next = levels[index]?.id
    if (next === undefined) throw new Error(t('sliderNoLevels'))

    previewRef.current = index
    setPreview(index)
    setEffort(next)

    try {
      const current = state.current
      if (current === null) throw new Error(t('sliderNoCurrent'))
      const outcome = await directory.select({
        provider: current.provider,
        model: current.model,
        reasoningEffort: next,
      })
      // Kernels through 0.1.6-alpha.1 reject by throwing; 0.1.6-alpha.2
      // resolves the refusal result instead. Normalizing it into a throw keeps
      // the optimistic rollback and the in-menu error line identical.
      const refusal = selectRefusalMessage(outcome)
      if (refusal !== undefined) throw new Error(refusal)

      const snapshot = directory.store.getSnapshot()
      const accepted = effortIndex(levels, snapshot.current?.reasoningEffort)
      const settled = accepted >= 0 ? accepted : index
      const settledId = levels[settled]?.id ?? next
      committedRef.current = settledId
      previewRef.current = settled
      setEffort(settledId)
      setPreview(settled)
    } catch (cause) {
      const restore = Math.max(0, effortIndex(levels, previous))
      committedRef.current = previous
      previewRef.current = restore
      setEffort(previous)
      setPreview(restore)
      setLocalError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      committingRef.current = false
      setCommitting(false)
    }
  }, [directory, levels, state.current])

  const rawFromPointer = (input: HTMLInputElement, clientX: number): number => {
    const bounds = input.getBoundingClientRect()
    if (bounds.width <= 0 || levels.length < 2) return previewRef.current
    return Math.max(
      0,
      Math.min(levels.length - 1, (clientX - bounds.left) / bounds.width * (levels.length - 1)),
    )
  }

  const showPointerPreview = (raw: number): void => {
    const index = snapIndex(raw, levels.length)
    const next = levels[index]?.id ?? ''
    if (previewRef.current === index && effort === next) return
    previewRef.current = index
    setPreview(index)
    setEffort(next)
  }

  const beginDragging = (input: HTMLInputElement, pointerId: number, clientX: number): void => {
    pointerActiveRef.current = true
    activePointerIdRef.current = pointerId
    draggingRef.current = true
    setDragging(true)
    showPointerPreview(rawFromPointer(input, clientX))
    try {
      if (!input.hasPointerCapture(pointerId)) input.setPointerCapture(pointerId)
    } catch {
      // The window-level pointer listeners below remain the reliable fallback.
    }
  }

  const moveDragging = (input: HTMLInputElement, pointerId: number, clientX: number): void => {
    if (!pointerActiveRef.current || activePointerIdRef.current !== pointerId) return
    showPointerPreview(rawFromPointer(input, clientX))
  }

  const stopDragging = (input: HTMLInputElement, pointerId?: number, clientX?: number): void => {
    if (!pointerActiveRef.current) return
    if (pointerId !== undefined && activePointerIdRef.current !== pointerId) return
    const raw = clientX === undefined ? previewRef.current : rawFromPointer(input, clientX)
    pointerActiveRef.current = false
    activePointerIdRef.current = null
    draggingRef.current = false
    if (pointerId !== undefined && input.hasPointerCapture(pointerId)) {
      input.releasePointerCapture(pointerId)
    }
    showPointerPreview(raw)
    void commit(raw)
  }

  globalPointerMoveRef.current = (event) => {
    const input = inputRef.current
    if (input !== null) moveDragging(input, event.pointerId, event.clientX)
  }
  globalPointerEndRef.current = (event) => {
    const input = inputRef.current
    if (input !== null) stopDragging(input, event.pointerId, event.clientX)
  }
  globalPointerCancelRef.current = (event) => {
    if (activePointerIdRef.current !== event.pointerId) return
    rollback()
  }

  useEffect(() => {
    const move = (event: PointerEvent) => globalPointerMoveRef.current?.(event)
    const end = (event: PointerEvent) => globalPointerEndRef.current?.(event)
    const cancel = (event: PointerEvent) => globalPointerCancelRef.current?.(event)
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', end, true)
    window.addEventListener('pointercancel', cancel, true)
    return () => {
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', end, true)
      window.removeEventListener('pointercancel', cancel, true)
    }
  }, [])

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    const count = levels.length
    const clamp = (value: number, max: number): number => Math.max(0, Math.min(max, Math.round(value)))
    const current = clamp(Number(event.currentTarget.value), count - 1)
    let target: number | undefined
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown' || event.key === 'PageDown') {
      target = Math.max(0, current - 1)
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'PageUp') {
      target = Math.min(count - 1, current + 1)
    } else if (event.key === 'Home') {
      target = 0
    } else if (event.key === 'End') {
      target = count - 1
    }
    if (target === undefined) return
    // The official menu roams focus with the same keys: keep them on the
    // slider while it owns the gesture.
    event.stopPropagation()
    event.preventDefault()
    void commit(target)
  }

  // The popover body is replicated from upstream: the slider (or the no-levels
  // hint), a separator, then ONE model row (name · current effort ›) whose
  // click opens the official model list. The official menu's two root cells
  // are hidden by the mount — the slider IS the effort control, so the
  // "Effort" drill-in is gone, and the model row is this replication.
  const current = state.current
  const group = state.groups.find(candidate => candidate.id === current?.provider)
  const model = group?.models.find(candidate => candidate.id === current?.model)
  // Labels follow the upstream row contract: the model text is the display
  // name or the bare model id, and the effort text follows the IN-FLIGHT
  // preview so the row names the level the thumb is on while dragging — once
  // the commit settles the preview rests on the store's value again.
  const modelLabel = model?.name ?? (current === null ? t('triggerFallback') : current.model)
  const effortLabel = levels[Math.max(0, Math.min(levels.length - 1, Math.round(preview)))]?.name ?? t('effortDefault')

  if (!available) {
    return createElement('div', { className: 'bre-slider-body' },
      createElement('div', { className: 'bre-slider-advanced' },
        createElement('span', { className: 'bre-slider-hint' }, t('sliderNoLevels')),
      ),
      createElement('div', { className: 'bre-menu-separator', 'aria-hidden': true }),
      createElement('button', {
        type: 'button',
        role: 'menuitem',
        className: 'bre-model-row',
        disabled: busy,
        onClick: () => { props.pickModel?.() },
      },
        createElement('span', { className: 'bre-model-row-name' }, modelLabel),
        createElement('span', { className: 'bre-model-row-effort' }, effortLabel),
        createElement('span', { className: 'bre-row-chevron', 'aria-hidden': true }, '›'),
      ),
      error === null
        ? null
        : createElement('div', { className: 'bre-model-error', role: 'status' }, error),
    )
  }

  const count = levels.length
  const effortName = levels[effortIndex(levels, effort)]?.name ?? effort
  const isTop = effortIndex(levels, effort) === count - 1
  const progress = preview / (count - 1) * 100
  const style = { '--bre-progress': String(progress) + '%' } as CSSProperties
  const title = error === null
    ? t('sliderEffortTitle', { name: effortName })
    : t('sliderEffortTitleError', { error })

  return createElement(
    'div',
    { className: 'bre-slider-body' },
    createElement(
      'div',
      { className: 'bre-slider-advanced' },
      createElement(
        'div',
        { 'data-bre-theme': theme, className: 'bre-effort is-chibi theme-' + theme + (dragging ? ' is-dragging' : '') + (busy ? ' is-busy' : '') + (error === null ? '' : ' is-error'), title },
        createElement(
          'div',
          { className: 'bre-effort-slider', 'data-top': isTop ? 'true' : undefined, style },
          createElement('div', { className: 'bre-effort-track', 'aria-hidden': true }),
          createElement('div', { className: 'bre-effort-fx', 'aria-hidden': true },
            createElement('canvas', { ref: canvasRef, className: 'bre-effort-canvas' }),
            createElement('span', { className: 'bre-effort-flare' }),
          ),
          createElement('input', {
            ref: inputRef,
            type: 'range',
            className: 'bre-effort-input',
            min: 0,
            max: count - 1,
            step: 1,
            value: preview,
            disabled: busy,
            'aria-label': t('sliderEffortAria'),
            'aria-valuetext': effortName,
            onChange: (event: { currentTarget: HTMLInputElement }) => {
              const raw = Number(event.currentTarget.value)
              showPointerPreview(raw)
            },
            onPointerDown: (event: { currentTarget: HTMLInputElement; pointerId: number; clientX: number; preventDefault: () => void }) => {
              event.preventDefault()
              event.currentTarget.focus()
              beginDragging(event.currentTarget, event.pointerId, event.clientX)
            },
            onPointerMove: (event: { currentTarget: HTMLInputElement; pointerId: number; clientX: number }) => moveDragging(event.currentTarget, event.pointerId, event.clientX),
            onPointerUp: (event: { currentTarget: HTMLInputElement; pointerId: number; clientX: number }) => stopDragging(event.currentTarget, event.pointerId, event.clientX),
            onPointerCancel: (event: { currentTarget: HTMLInputElement; pointerId: number }) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId)
              }
              rollback()
            },
            onBlur: (event: { currentTarget: HTMLInputElement }) => {
              stopDragging(event.currentTarget)
            },
            onKeyDown: onKeyDown,
          }),
          createElement('span', { className: 'bre-effort-knob', 'aria-hidden': true }),
        ),
        error === null
          ? null
          : createElement('span', { className: 'bre-effort-sr', role: 'status' }, error),
      ),
    ),
    createElement('div', { className: 'bre-menu-separator', 'aria-hidden': true }),
    createElement('button', {
      type: 'button',
      role: 'menuitem',
      className: 'bre-model-row',
      disabled: busy,
      onClick: () => { props.pickModel?.() },
    },
      createElement('span', { className: 'bre-model-row-name' }, modelLabel),
      createElement('span', { className: 'bre-model-row-effort' }, effortLabel),
      createElement('span', { className: 'bre-row-chevron', 'aria-hidden': true }, '›'),
    ),
    error === null
      ? null
      : createElement('div', { className: 'bre-model-error', role: 'status' }, error),
  )
}
