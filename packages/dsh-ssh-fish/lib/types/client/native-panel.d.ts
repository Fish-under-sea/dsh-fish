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
 * @module @fish-under-sea/dsh-ssh-fish/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { SshApi } from './api.ts';
import { SSH_PANEL_ID, type PanelController } from './panel/controller.ts';
import { type TerminalFontSource } from './panel/helpers.ts';
/** The panel id shared by the sidebar row and the main-slot occupant. */
export { SSH_PANEL_ID };
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
export declare function SshPanelIcon({ size }: {
    size: number;
    active: boolean;
}): React.ReactElement;
/**
 * The main-slot page. The layout mounts it only while this panel is selected;
 * the wrapper carries the pinned `data-dsh-ssh-view` semantic anchor (L2
 * contract, skins) the takeover container used to own.
 * @param props - the framework main-slot share plus this entry's injected face.
 * @returns the SSH panel page.
 */
export declare function SshPanelPage({ controller, api, terminalFont }: {
    controller: PanelController;
    api: SshApi;
    terminalFont?: TerminalFontSource;
}): React.ReactElement;
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
export declare function registerSshPanel(ctx: ClientContext, controller: PanelController, api: SshApi, terminalFont?: TerminalFontSource): () => void;
