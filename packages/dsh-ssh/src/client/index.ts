/**
 * Browser-half entry for the dsh-ssh plugin — runs inside the dsh web GUI.
 *
 * Registers the dsh-ssh locale dictionaries and mounts the two DOM surfaces:
 * the sidebar entry row (toggles the panel) and the SSH operations panel in
 * the center column. Failure policy: DOM mounting problems are logged, never
 * thrown — the web shell fails the whole boot when a plugin apply throws, and
 * an external plugin must not take the GUI down.
 *
 * Export discipline (packages/client rule): the /client surface carries what
 * cordis loading needs plus types only — all value exports stay internal.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the shared-forms Context merge (ctx.configForms).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the ctx.slots merge (the renderer owns the slot registry since 0.1.2).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the LocaleNamespaceMap merge table.
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { SshApi } from './api.ts'
import { en, zh, type SshKey } from './locales.ts'
import { registerSshPanel } from './native-panel.tsx'
import { PanelController, SSH_PANEL_ID } from './panel/controller.ts'
import type { TerminalFontSource } from './panel/helpers.ts'
import { setRuntimeTranslate } from './panel/helpers.ts'
import { bindSettingsReader } from './settings-binding.ts'

/** Locale namespace this plugin owns. */
const NS = 'dsh-ssh'

/**
 * Family settings namespace the terminal-font preference is addressed by
 * (issue #577); dsh-web-settings maps it to the owning profile entry id.
 */
const SETTINGS_NS = 'dsh-ssh'

/** The dsh-ssh settings section the browser half reads. */
interface SshClientSettings {
  /** User-configured xterm fontFamily; empty/undefined means the CSS chain. */
  terminalFontFamily?: string
}

/** The one field this plugin's own Config schema declares (its entry identity on the shared settings surface). */
const TERMINAL_FONT_FIELD = 'terminalFontFamily' satisfies keyof SshClientSettings

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** dsh-ssh surface copy. */
    'dsh-ssh': SshKey
  }
}

/** Required services (fiber inject waiting — the runtime must be up first). */
export const inject = ['slots', 'locale', 'configForms', 'layout']

/** Type-only surface (export discipline: no value exports beyond the plugin contract). */
export type { PanelControllerSnapshot } from './panel/controller.ts'
export type { SshPanelProps } from './panel/SshPanel.tsx'
export type { HostsTabProps } from './panel/HostsTab.tsx'
export type { HostFormDialogProps } from './panel/HostFormDialog.tsx'
export type { TerminalTabProps } from './panel/TerminalTab.tsx'
export type { TransferTabProps } from './panel/TransferTab.tsx'
export type { TunnelsTabProps } from './panel/TunnelsTab.tsx'
export type { ClusterTabProps } from './panel/ClusterTab.tsx'
export type { SshKey } from './locales.ts'

/**
 * Mount the SSH panel.
 * @param ctx - client root context (locale service).
 */
export function apply(ctx: ClientContext): void {

  ctx.effect(() => {
    try {
      return ctx.locale.register(NS, { zh, en })
    } catch {
      return () => {}
    }
  }, 'dsh-ssh: dictionaries')

  // Wire the SDK translate seat into the module-level tt (sidebar row and
  // other plain-DOM callers): reads the active locale at call time, so they
  // follow the Language setting without a reload.
  try { setRuntimeTranslate(ctx.locale.bind(NS)) } catch { /* locale missing: document-language fallback stays */ }

  // Panel navigation belongs to the layout service: the panel asks it to
  // select its own panel id (or the conversation) instead of taking over the
  // center column at the DOM level. The lookup stays lazy so a selection
  // issued before the service settles still lands once it does, and the face
  // throws by contract before the layout root entry mounts, which the
  // controller tolerates.
  const controller = new PanelController({
    panel: {
      select: panelId => {
        const layout = (ctx as unknown as { get?(name: string): unknown }).get?.('layout') as { selectPanel?: (id: string | null) => void } | undefined
        layout?.selectPanel?.(panelId)
      },
    },
  })
  const api = new SshApi()
  // Live terminal-font preference (issue #577): the field lives in this
  // plugin's own profile entry, whose settings page the Host generates from
  // the plugin Config schema; the panel re-applies a change to open terminals
  // without a reconnect.
  const settings = bindSettingsReader<SshClientSettings>(ctx, SETTINGS_NS, TERMINAL_FONT_FIELD)
  const terminalFont: TerminalFontSource = {
    get: () => {
      const snapshot = settings.getSnapshot()
      return snapshot.status === 'ready' ? snapshot.value?.terminalFontFamily : undefined
    },
    subscribe: (listener) => settings.subscribe(listener),
  }
  ctx.effect(() => () => { settings.dispose() }, 'dsh-ssh: settings binding')
  const disposers: Array<() => void> = []
  try {
    disposers.push(registerSshPanel(ctx, controller, api, terminalFont))
    // The layout's panel selection is reconciled back into the controller, so
    // the panel follows the user clicking another panel row.
    const layoutFace = (ctx as unknown as { get?(name: string): unknown }).get?.('layout') as { panelInfo?: { subscribe(listener: () => void): () => void; getSnapshot(): { activePanelId: unknown } } } | undefined
    if (layoutFace?.panelInfo !== undefined) {
      const sync = (): void => {
        const active = layoutFace.panelInfo!.getSnapshot().activePanelId
        controller.syncPanelSelection(active === SSH_PANEL_ID ? SSH_PANEL_ID : null)
      }
      sync()
      disposers.push(layoutFace.panelInfo.subscribe(sync))
    }
  } catch (error) {
    // Registration failures degrade the panel, never the GUI.
    console.warn('[dsh-ssh] panel registration failed:', error)
  }
  ctx.effect(() => () => {
    for (const dispose of disposers.splice(0)) dispose()
  }, 'dsh-ssh: ui mounts')
}
