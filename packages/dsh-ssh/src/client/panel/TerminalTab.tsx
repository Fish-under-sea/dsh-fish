/**
 * Terminal tab: an xterm.js PTY view over the host's WebSocket terminal route.
 * A host <select> plus connect/disconnect controls; the terminal container is
 * sized by FitAddon (default 80x24 before first fit). On remote exit the last
 * output stays visible and input is disabled. xterm's stylesheet is injected
 * once per page load (module-level guard).
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Terminal, type IDisposable } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import type { SshApi, TerminalConnection } from '../api.ts'
import type { SshHostSummary } from '../../protocol.ts'
import type { PanelController } from './controller.ts'
import { XTERM_CSS } from './xterm.css.ts'
import { errorMessage, resolveTerminalFontFamily, tt, type TerminalFontSource } from './helpers.ts'
import css from './panel.module.css'

/** Terminal tab props. */
export interface TerminalTabProps {
  api: SshApi
  /** The panel controller that owns the live host session id across mounts. */
  controller: PanelController
  /** Host session to reattach to on mount (survives a panel switch). */
  sessionId?: string
  /** Alias preselected by a "connect" action from the hosts tab. */
  presetAlias?: string
  /** Monotonic id of the connect request (re-applies presetAlias). */
  requestId?: number
  /**
   * Live terminal-font setting source (issue #577). Absent in tests and
   * legacy mounts: the font then comes from the CSS custom-property chain.
   */
  terminalFont?: TerminalFontSource
}

/** The terminal session lifecycle state shown in the status banner. */
type TerminalStatus =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'connected'; alias: string }
  | { kind: 'exited'; alias: string; detail?: string }
  | { kind: 'error'; detail: string }

/** In-flight 2FA challenge prompts. */
interface AuthPromptState {
  name: string
  instructions: string
  prompts: Array<{ prompt: string; echo: boolean }>
}

/** Injected-once guard for the xterm stylesheet (one tag per page load). */
let xtermCssInjected = false

function ensureXtermCss(): void {
  if (xtermCssInjected || typeof document === 'undefined') return
  xtermCssInjected = true
  if (document.querySelector('style[data-dsh-ssh-xterm]') !== null) return
  const style = document.createElement('style')
  style.dataset.dshSshXterm = ''
  style.textContent = XTERM_CSS
  document.head.appendChild(style)
}

/** No-op source stand-in so the hook order stays stable without the prop. */
const NO_FONT_SOURCE: TerminalFontSource = {
  get: () => undefined,
  subscribe: () => () => undefined,
}

/** The xterm terminal view. */
export function TerminalTab({ api, controller, sessionId, presetAlias, requestId, terminalFont }: TerminalTabProps) {
  const [hosts, setHosts] = useState<SshHostSummary[]>([])
  const [alias, setAlias] = useState(presetAlias ?? '')
  const [status, setStatus] = useState<TerminalStatus>({ kind: 'idle' })
  const [authPrompt, setAuthPrompt] = useState<AuthPromptState | undefined>(undefined)
  const [authInputs, setAuthInputs] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const connRef = useRef<TerminalConnection | null>(null)
  const dataSubRef = useRef<IDisposable | null>(null)
  const fontSource = terminalFont ?? NO_FONT_SOURCE
  const fontOverride = useSyncExternalStore(fontSource.subscribe, fontSource.get)

  useEffect(() => { ensureXtermCss() }, [])

  // Live re-apply a terminal-font change (issue #577): xterm re-measures
  // and repaints on the options write; a refit keeps cols/rows aligned with
  // the new metrics and the remote PTY learns the new size.
  useEffect(() => {
    const term = termRef.current
    if (term === null) return
    const next = resolveTerminalFontFamily(fontOverride)
    if (term.options.fontFamily === next) return
    term.options.fontFamily = next
    fitRef.current?.fit()
    connRef.current?.resize(term.cols, term.rows)
  }, [fontOverride])

  // Fetch the host list on tab activation.
  useEffect(() => {
    let disposed = false
    void (async () => {
      try {
        const list = await api.listHosts()
        if (!disposed) setHosts(list)
      } catch (cause) {
        if (!disposed) setStatus({ kind: 'error', detail: errorMessage(cause) })
      }
    })()
    return () => { disposed = true }
  }, [api])

  // A hosts-tab connect action preselects its alias here.
  useEffect(() => {
    if (presetAlias !== undefined) setAlias(presetAlias)
  }, [presetAlias, requestId])

  /**
   * Tear the view down.
   * @param leave - `detach` leaves the host session alive for a reattach
   *   (panel switch, unmount); `close` ends it (the disconnect control).
   */
  const teardown = (leave: 'detach' | 'close'): void => {
    setAuthPrompt(undefined)
    setAuthInputs([])
    const connection = connRef.current
    connRef.current = null
    if (connection !== null) {
      connection.onReady = undefined
      connection.onOutput = undefined
      connection.onExit = undefined
      connection.onAuthPrompt = undefined
      if (leave === 'detach') connection.detach()
      else connection.close()
    }
    // Release the xterm input subscription explicitly and dispose the
    // terminal so no listener (or the terminal Renderer) survives a
    // disconnect or the tab unmounting.
    dataSubRef.current?.dispose()
    dataSubRef.current = null
    termRef.current?.dispose()
    termRef.current = null
    fitRef.current = null
  }

  // Unmount cleanup (never touches state on an unmounting component). The
  // host keeps the shell alive, so returning to this tab reattaches to it.
  useEffect(() => () => { teardown('detach') }, [])

  // Keep the terminal fitted to its container. A window resize is only one
  // trigger: the status banner appearing after connect, panel resizes, and
  // sidebar toggles all change the container without a window resize, so the
  // container itself is observed (otherwise the viewport keeps the pre-banner
  // height and the last line is clipped below the fold). ResizeObserver may
  // be absent (jsdom tests); the window listener then remains the only path.
  useEffect(() => {
    let lastCols = -1
    let lastRows = -1
    const sync = (): void => {
      const term = termRef.current
      const fit = fitRef.current
      if (term === null || fit === null) return
      fit.fit()
      const conn = connRef.current
      if (conn !== null && (term.cols !== lastCols || term.rows !== lastRows)) {
        lastCols = term.cols
        lastRows = term.rows
        conn.resize(term.cols, term.rows)
      }
    }
    window.addEventListener('resize', sync)
    const container = containerRef.current
    if (container === null || typeof ResizeObserver === 'undefined') {
      return () => { window.removeEventListener('resize', sync) }
    }
    const observer = new ResizeObserver(() => { sync() })
    observer.observe(container)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [])

  /**
   * Build the xterm view and bind one connection to it.
   * @param open - opens the transport once the terminal has a size.
   */
  const startSession = (open: (cols: number, rows: number) => TerminalConnection): void => {
    const container = containerRef.current
    if (container === null) return
    if (status.kind === 'connecting' || status.kind === 'connected') return
    teardown('detach')
    setStatus({ kind: 'connecting' })
    const term = new Terminal({
      convertEol: false,
      cursorBlink: true,
      fontSize: 13,
      fontFamily: resolveTerminalFontFamily(fontOverride),
      theme: { background: '#0b0e14', foreground: '#d8dee9', cursor: '#a3b8d0' },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)
    fit.fit()
    const connection = open(term.cols, term.rows)
    termRef.current = term
    fitRef.current = fit
    connRef.current = connection
    let settled = false
    let connectedAlias = ''
    dataSubRef.current = term.onData(data => { connection.send(data) })
    connection.onAuthPrompt = (name, instructions, prompts) => {
      setAuthPrompt({ name, instructions, prompts })
      setAuthInputs(prompts.map(() => ''))
    }
    connection.onReady = (id, readyAlias) => {
      // Remember the host session so a later mount of this tab reattaches to
      // the same shell instead of opening a second one.
      connectedAlias = readyAlias
      controller.setTerminalSession(id)
      setAuthPrompt(undefined)
      setAuthInputs([])
      setStatus({ kind: 'connected', alias: readyAlias })
    }
    connection.onOutput = data => { term.write(data) }
    connection.onExit = (_code, error) => {
      if (settled) return
      settled = true
      setAuthPrompt(undefined)
      setAuthInputs([])
      dataSubRef.current?.dispose()
      dataSubRef.current = null
      term.options.disableStdin = true
      connRef.current = null
      // The session is gone: drop the id so the next mount starts fresh.
      controller.clearTerminalSession()
      // Keep the last output visible; input is now disabled.
      setStatus({ kind: 'exited', alias: connectedAlias !== '' ? connectedAlias : alias, detail: error })
    }
  }

  const connect = (): void => {
    const target = alias
    if (target === '') return
    startSession((cols, rows) => api.openTerminal(target, cols, rows))
  }

  // Reattach to a host session that outlived this view (panel switch or a
  // remount of the page). The host replays its scrollback before ready, so
  // the terminal comes back with its history instead of a blank screen.
  const reattachedRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (sessionId === undefined || connRef.current !== null) return
    if (reattachedRef.current === sessionId) return
    reattachedRef.current = sessionId
    startSession((cols, rows) => api.attachTerminal(sessionId, cols, rows))
  }, [sessionId])

  const disconnect = (): void => {
    teardown('close')
    controller.clearTerminalSession()
    setStatus({ kind: 'idle' })
  }

  const submitAuth = (e?: React.FormEvent): void => {
    e?.preventDefault()
    if (connRef.current === null || authPrompt === undefined) return
    connRef.current.sendAuthResponse(authInputs)
    setAuthPrompt(undefined)
  }

  const active = status.kind === 'connecting' || status.kind === 'connected'

  return (
    <div className={css.termBody}>
      <div className={css.controls}>
        <select className={css.input} value={alias} onChange={event => { setAlias(event.target.value) }}>
          <option value="">{tt('terminal.selectHost')}</option>
          {hosts.map(host => <option key={host.alias} value={host.alias}>{host.alias} ({host.host})</option>)}
        </select>
        <button type="button" className={css.primaryButton} disabled={alias === '' || active} onClick={connect}>{tt('terminal.connect')}</button>
        <button type="button" className={css.ghostButton} disabled={!active} onClick={disconnect}>{tt('terminal.disconnect')}</button>
      </div>
      {status.kind === 'connecting' && <div className={css.banner} data-kind="info">{tt('terminal.connecting')}</div>}
      {status.kind === 'connected' && <div className={css.banner} data-kind="ok">{tt('terminal.ready', { alias: status.alias })}</div>}
      {status.kind === 'exited' && (
        <div className={css.banner} data-kind="info">{tt('terminal.exited', { alias: status.alias })}{status.detail !== undefined ? ' (' + status.detail + ')' : ''}</div>
      )}
      {status.kind === 'error' && <div className={css.banner} data-kind="error">{tt('terminal.error', { error: status.detail })}</div>}
      <div className={css.termWrap}>
        <div ref={containerRef} className={css.termContainer} data-dsh-part="terminal" />
        {status.kind === 'idle' && (
          <div className={css.termPlaceholder}>{hosts.length === 0 ? tt('hosts.empty') : tt('terminal.placeholder')}</div>
        )}
        {authPrompt !== undefined && (
          <div className={css.modalBackdrop} style={{ position: 'absolute', zIndex: 10 }}>
            <form className={css.modalCard} style={{ maxWidth: 420 }} onSubmit={submitAuth}>
              <div className={css.modalHeader}>
                <h3 className={css.modalTitle}>{authPrompt.name || tt('terminal.auth.title')}</h3>
              </div>
              <p className={css.hint}>{authPrompt.instructions || tt('terminal.auth.hint')}</p>
              {authPrompt.prompts.map((p, idx) => (
                <label key={idx} className={css.field}>
                  <span className={css.fieldLabel}>{p.prompt.trim() || tt('terminal.auth.title')}</span>
                  <input
                    autoFocus={idx === 0}
                    className={css.input}
                    type={p.echo ? 'text' : 'password'}
                    placeholder={tt('terminal.auth.placeholder')}
                    value={authInputs[idx] ?? ''}
                    onChange={event => {
                      const next = [...authInputs]
                      next[idx] = event.target.value
                      setAuthInputs(next)
                    }}
                  />
                </label>
              ))}
              <div className={css.modalFooter}>
                <button type="button" className={css.ghostButton} onClick={disconnect}>{tt('terminal.auth.cancel')}</button>
                <button type="submit" className={css.primaryButton}>{tt('terminal.auth.submit')}</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
