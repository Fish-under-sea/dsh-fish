/**
 * SSH panel controller: the single owner of the panel's view state.
 *
 * Framework-free (structural runtime faces, task-board core/controller.ts
 * style) so the sidebar row and the React panel share one tiny subscription
 * surface. The state lives only for the browser session (no persistence).
 *
 * The active tab, the hosts-tab connect request and the live terminal session
 * id live here rather than inside the panel components: the layout mounts a
 * keyed page only while its panel is selected, so component-local state would
 * reset the tab on every panel switch and lose the id a reattach needs.
 */

/** The panel's tab identifiers. */
export type SshTab = 'hosts' | 'terminal' | 'transfer' | 'tunnels' | 'cluster'

/** A "connect" action from the hosts tab, handed to the terminal tab. */
export interface ConnectRequest {
  alias: string
  /** Monotonic id so a repeated connect for the same alias still re-applies. */
  nonce: number
}

/** Stable id shared by the sidebar panel row and the main-slot page. */
export const SSH_PANEL_ID = 'ssh'

/** Immutable controller snapshot for UI subscriptions. */
export interface PanelControllerSnapshot {
  /** Whether the center column shows this panel. */
  panelOpen: boolean
  /** The tab the panel is showing. */
  activeTab: SshTab
  /** Pending hosts-tab connect request, or null. */
  connectRequest: ConnectRequest | null
  /** Host-side terminal session the terminal tab should reattach to, if any. */
  terminalSessionId: string | undefined
}

/**
 * The layout's panel-navigation face: selecting the panel is the layout's
 * business, and this is the one call that asks for it (null returns the column
 * to the conversation). Optional, so a shell-less composition keeps the pure
 * state transitions testable.
 */
export interface PanelNavigationFace {
  /** Select this panel, or null to hand the column back to the conversation. */
  select(panelId: string | null): void
}

/** Controller dependencies. */
export interface PanelControllerDeps {
  /** Layout panel selection; absent keeps the controller state-only. */
  panel?: PanelNavigationFace
}

/** The panel state owner the sidebar row and the view both read. */
export class PanelController {
  private panelOpen = false
  private activeTab: SshTab = 'hosts'
  private connectRequest: ConnectRequest | null = null
  private terminalSessionId: string | undefined
  private listeners = new Set<() => void>()
  /** Cached so getSnapshot is referentially stable between changes. */
  private snapshot: PanelControllerSnapshot = {
    panelOpen: false,
    activeTab: 'hosts',
    connectRequest: null,
    terminalSessionId: undefined,
  }

  constructor(private readonly deps: PanelControllerDeps = {}) {}

  getSnapshot(): PanelControllerSnapshot {
    return this.snapshot
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  /**
   * Show the panel. The layout owns which panel the column renders, so the
   * state flip and the selection travel together; the selection is requested
   * after the snapshot flips, so a subscriber never observes "open" while the
   * shell still shows the conversation.
   */
  open(): void {
    if (this.panelOpen) return
    this.panelOpen = true
    this.commit()
    this.selectPanel(SSH_PANEL_ID)
  }

  /** Return the column to the conversation, asking the layout explicitly. */
  close(): void {
    if (!this.panelOpen) return
    this.panelOpen = false
    this.commit()
    this.selectPanel(null)
  }

  toggle(): void {
    if (this.panelOpen) this.close()
    else this.open()
  }

  /**
   * Reflect a selection made outside this controller (the user clicked another
   * sidebar row, or the layout dropped the panel id).
   * @param panelId - the layout's current panel id, or null for the conversation.
   */
  syncPanelSelection(panelId: string | null): void {
    const open = panelId === SSH_PANEL_ID
    if (open === this.panelOpen) return
    this.panelOpen = open
    this.commit()
  }

  /** Switch tabs, keeping every other piece of view state. */
  setActiveTab(tab: SshTab): void {
    if (this.activeTab === tab) return
    this.activeTab = tab
    this.commit()
  }

  /** Hand the terminal tab a host to connect to (hosts-tab "connect" action). */
  requestConnect(alias: string): void {
    this.connectRequest = { alias, nonce: Date.now() }
    this.activeTab = 'terminal'
    this.commit()
  }

  /** Record the host-side session so a later page mount can reattach. */
  setTerminalSession(sessionId: string): void {
    if (this.terminalSessionId === sessionId) return
    this.terminalSessionId = sessionId
    this.commit()
  }

  /** Forget the session (it exited, or the user disconnected). */
  clearTerminalSession(): void {
    if (this.terminalSessionId === undefined) return
    this.terminalSessionId = undefined
    this.commit()
  }

  private commit(): void {
    this.snapshot = {
      panelOpen: this.panelOpen,
      activeTab: this.activeTab,
      connectRequest: this.connectRequest,
      terminalSessionId: this.terminalSessionId,
    }
    for (const fn of [...this.listeners]) fn()
  }

  /** Ask the layout to select a panel; a shell without the face is a no-op. */
  private selectPanel(panelId: string | null): void {
    try {
      this.deps.panel?.select(panelId)
    } catch {
      // The layout service throws by contract before its root entry mounts;
      // the state flip above already stands and the next selection retries.
    }
  }
}
