/**
 * Native panel registration for the SSH panel.
 *
 * The panel is an official-style center-column page, not a DOM takeover: it
 * contributes a row into the sidebar shell's own global panel list
 * (`sidebar.panellist`) and its page into the layout's keyed `main` slot. The
 * shell then owns the row box, the label, the active highlight, the collapsed
 * rail and the panel switch, exactly as it does for the shipped Plugins and
 * Schedule pages and for the task board and the skill center.
 *
 * Both registrations go through `ctx.slots.inject`, which fires only once the
 * owning shell entry has declared the seat: load order between this plugin and
 * ui-layout / ui-sidebar therefore does not matter, and neither does a shell
 * that cannot serve the seats (the callback simply never runs).
 *
 * The terminal's PTY shell lives on the host and outlives this page (see
 * engine/terminal-sessions.ts), so the layout unmounting a deselected page
 * costs the view its xterm instance, not the remote session: the terminal tab
 * reattaches by session id when the page mounts again.
 *
 * @module @fish-under-sea/dsh-ssh/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { SshApi } from './api.ts'
import { SSH_PANEL_ID, type PanelController } from './panel/controller.ts'
import { tt, type TerminalFontSource } from './panel/helpers.ts'
import { SshPanel } from './panel/SshPanel.tsx'
import css from './panel/panel.module.css'

/** The panel id shared by the sidebar row and the main-slot occupant. */
export { SSH_PANEL_ID }

/** Row order among the shell's global panel rows (Plugins 0, Schedule 10, board 20, skill center 30). */
const PANEL_ORDER = 40

/**
 * The sidebar row glyph the shell asks for at its own size and active state.
 * The shell owns the button, label, tooltip and rail geometry; this component
 * draws only the glyph, like every other panel row.
 *
 * The glyph carries `data-dsh-panel-entry` because it is the only DOM this
 * panel's own code owns inside that shell-owned row: the L2 contract (skins)
 * resolves which row belongs to which plugin through it, since the shell
 * stamps no per-entry hook of its own (see contracts/semantic-attrs-v1.md).
 * @param props - the shell's icon share: square edge and selection state.
 * @returns the decorative terminal glyph.
 */
export function SshPanelIcon({ size }: { size: number; active: boolean }): React.ReactElement {
  return (
    <svg
      data-dsh-panel-entry={SSH_PANEL_ID}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1.75" y="2.25" width="12.5" height="11.5" rx="1.75" />
      <path d="M4.25 5.25l2.75 2.75-2.75 2.75" />
      <path d="M8.5 10.75h3.25" />
    </svg>
  )
}

/**
 * The main-slot page. The layout mounts it only while this panel is selected;
 * the wrapper carries the pinned `data-dsh-ssh-view` semantic anchor (L2
 * contract, skins) the takeover container used to own.
 * @param props - the framework main-slot share plus this entry's injected face.
 * @returns the SSH panel page.
 */
export function SshPanelPage({ controller, api, terminalFont }: {
  controller: PanelController
  api: SshApi
  terminalFont?: TerminalFontSource
}): React.ReactElement {
  return (
    <div className={css.view} data-dsh-ssh-view="" data-dsh-plugin="ssh">
      <SshPanel controller={controller} api={api} terminalFont={terminalFont} />
    </div>
  )
}

/** The injected face both registrations receive. */
interface PanelFace {
  controller: PanelController
  api: SshApi
  terminalFont?: TerminalFontSource
}

/**
 * Register the SSH panel's sidebar row and center-column page.
 *
 * Both seats are declared by shell plugins this package does not depend on at
 * runtime, so each registration is wrapped in `ctx.slots.inject`: the callback
 * runs only after the owning entry declares the seat, and a shell that never
 * declares it leaves the panel simply absent instead of failing boot.
 * @param ctx - client root context (services: slots).
 * @param controller - the controller the page and the row drive.
 * @param api - the SSH API client the page operates through.
 * @param terminalFont - live terminal-font setting source (issue #577).
 * @returns disposer releasing both registrations.
 */
export function registerSshPanel(
  ctx: ClientContext,
  controller: PanelController,
  api: SshApi,
  terminalFont?: TerminalFontSource,
): () => void {
  const slots = ctx.slots as {
    inject(key: string, callback: () => () => void): () => void
    register(options: Record<string, unknown>, component: unknown): () => void
  }
  const disposers: Array<() => void> = []

  disposers.push(slots.inject('sidebar.panellist', () => slots.register({
    name: 'sidebar.panellist',
    id: SSH_PANEL_ID,
    order: PANEL_ORDER,
    // The shell resolves this through resolveSlotLabel on every locale change,
    // so the module-level translate reads the active language at call time.
    label: () => tt('entry.label'),
  }, SshPanelIcon)))

  disposers.push(slots.inject('main', () => slots.register({
    name: 'main',
    key: SSH_PANEL_ID,
    inject: (): PanelFace => ({ controller, api, terminalFont }),
  }, SshPanelPage as never)))

  return () => {
    for (const dispose of disposers.splice(0)) dispose()
  }
}
