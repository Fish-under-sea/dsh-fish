/**
 * SSH panel controller: the single owner of the panel's view state.
 *
 * Framework-free (structural runtime faces, task-board core/controller.ts
 * style) so the sidebar row and the React panel share one tiny subscription
 * surface. The state lives only for the browser session (no persistence).
 *
 * The active tab, the hosts-tab connect request, the terminal tabs and their
 * host session ids live here rather than inside the panel components: the
 * layout mounts a keyed page only while its panel is selected, so
 * component-local state would reset the tab on every panel switch and lose
 * the ids a reattach needs.
 *
 * Terminal tabs (issue #1950) are records, not sockets. One tab is the tab
 * shown in the single xterm; a tab that is not shown either owns a detached
 * host session (reattached by id, which replays the host scrollback) or no
 * session at all. The controller is also the place where a still-connecting
 * socket is adopted when a view goes away: a connection that has not reported
 * its session id yet cannot be detached, so dropping it would leave the host
 * PTY with no owner (the orphan the reference implementation produced).
 */
import type { TerminalConnection } from '../api.ts';
/** The panel's tab identifiers. */
export type SshTab = 'hosts' | 'terminal' | 'transfer' | 'tunnels' | 'cluster';
/** Stable id shared by the sidebar panel row and the main-slot page. */
export declare const SSH_PANEL_ID = "ssh";
/** Lifecycle of one terminal tab. */
export type TerminalTabStatus = 
/** Socket open, the host has not reported a session id yet. */
'connecting'
/** The host reported a session id; the shell is live. */
 | 'connected'
/** The remote shell ended. The tab keeps its screen; the session id is cleared. */
 | 'exited'
/** The connection failed. The tab keeps the reason; the session id is cleared. */
 | 'error';
/** A keyboard-interactive challenge waiting for this tab's answer. */
export interface TerminalAuthPrompt {
    name: string;
    instructions: string;
    prompts: Array<{
        prompt: string;
        echo: boolean;
    }>;
}
/** One terminal tab, independent of the socket that currently serves it. */
export interface TerminalTabRecord {
    /** Local tab id, stable across panel switches (never the host session id). */
    id: string;
    /** Host alias this tab opened. Several tabs may share one alias. */
    alias: string;
    status: TerminalTabStatus;
    /** Host-side PTY session id, present only while the shell is live. */
    sessionId?: string;
    /** Exit or failure text for the `exited` / `error` states. */
    detail?: string;
    /** Code of a close that never reached the host; the tab is kept. */
    closeError?: string;
    /** Challenge captured for this tab, whoever was on screen when it arrived. */
    authPrompt?: TerminalAuthPrompt;
    /**
     * The answer being typed for {@link TerminalTabRecord.authPrompt}, owned by
     * this tab: one shared draft let a challenge on tab B inherit (and submit)
     * the characters typed for tab A.
     */
    authAnswers?: string[];
}
/** The terminal fields a later step may change on one tab. */
export type TerminalTabPatch = Omit<TerminalTabRecord, 'id' | 'alias'>;
/** What to do with an adopted connection once the host reports its session. */
export type TerminalLinkIntent = 'detach' | 'close';
/** Immutable controller snapshot for UI subscriptions. */
export interface PanelControllerSnapshot {
    /** Whether the center column shows this panel. */
    panelOpen: boolean;
    /** The tab the panel is showing. */
    activeTab: SshTab;
    /** Every terminal tab, in strip order. */
    terminalTabs: readonly TerminalTabRecord[];
    /** The tab the single xterm is bound to, or undefined when there is none. */
    activeTerminalTabId: string | undefined;
    /** Host picked in the terminal toolbar; the next tab opens on it. */
    draftAlias: string;
}
/**
 * The layout's panel-navigation face: selecting the panel is the layout's
 * business, and this is the one call that asks for it (null returns the column
 * to the conversation). Optional, so a shell-less composition keeps the pure
 * state transitions testable.
 */
export interface PanelNavigationFace {
    /** Select this panel, or null to hand the column back to the conversation. */
    select(panelId: string | null): void;
}
/** Controller dependencies. */
export interface PanelControllerDeps {
    /** Layout panel selection; absent keeps the controller state-only. */
    panel?: PanelNavigationFace;
}
/** The panel state owner the sidebar row and the view both read. */
export declare class PanelController {
    private readonly deps;
    private panelOpen;
    private activeTab;
    private terminalTabs;
    private activeTerminalTabId;
    private draftAlias;
    private nextTerminalTabSeq;
    private listeners;
    /**
     * Last screen of each tab, kept outside the snapshot: terminal output must
     * not re-render the panel on every chunk, and only the terminal view reads
     * this (when a tab has no session left to replay from).
     */
    private readonly retainedScreens;
    /**
     * Sockets that outlived their view while still connecting. Their session id
     * is unknown, so they cannot be detached yet; keeping them here is what
     * prevents a host PTY with no owner.
     */
    private readonly adoptedLinks;
    /** Cached so getSnapshot is referentially stable between changes. */
    private snapshot;
    constructor(deps?: PanelControllerDeps);
    getSnapshot(): PanelControllerSnapshot;
    subscribe(fn: () => void): () => void;
    /**
     * Show the panel. The layout owns which panel the column renders, so the
     * state flip and the selection travel together; the selection is requested
     * after the snapshot flips, so a subscriber never observes "open" while the
     * shell still shows the conversation.
     */
    open(): void;
    /** Return the column to the conversation, asking the layout explicitly. */
    close(): void;
    toggle(): void;
    /**
     * Reflect a selection made outside this controller (the user clicked another
     * sidebar row, or the layout dropped the panel id).
     * @param panelId - the layout's current panel id, or null for the conversation.
     */
    syncPanelSelection(panelId: string | null): void;
    /** Switch tabs, keeping every other piece of view state. */
    setActiveTab(tab: SshTab): void;
    /**
     * Hand the terminal tab a host to connect to (the hosts-tab "connect"
     * action): the tab exists before the view does, so a panel switch during the
     * handshake still shows the connecting tab and adopts its socket.
     * @param alias - the configured host alias.
     */
    requestConnect(alias: string): void;
    /**
     * Add a terminal tab on the alias and make it the shown one. Several tabs
     * may target one alias on purpose: each owns its own host PTY.
     * @param alias - the configured host alias.
     * @returns the new tab id.
     */
    openTerminalTab(alias: string): string;
    /**
     * Show an existing tab and make the toolbar follow its host, so a new tab
     * opens on the host the user is looking at.
     * @param id - the tab id.
     */
    setActiveTerminalTab(id: string): void;
    /**
     * Remove one tab and forget its screen. When the shown tab closes, the
     * neighbours decide what the xterm shows next: the tab that took its place,
     * else the one before it, else nothing.
     * @param id - the tab id.
     */
    closeTerminalTab(id: string): void;
    /** The tab record with this id, or undefined when it no longer exists. */
    terminalTab(id: string): TerminalTabRecord | undefined;
    /**
     * Apply a partial update to one tab; a tab that was closed in the meantime
     * is left alone rather than resurrected.
     * @param id - the tab id.
     * @param patch - the fields to change.
     */
    patchTerminalTab(id: string, patch: Partial<TerminalTabPatch>): void;
    /**
     * Record the host session of a ready tab and clear the challenge it carried.
     * @param id - the tab id.
     * @param sessionId - the id the host reported on its ready frame.
     */
    readyTerminalTab(id: string, sessionId: string): void;
    /**
     * The remote shell ended: the tab keeps its screen and its place, and the
     * dead session id is dropped so nothing tries to reattach to it.
     * @param id - the tab id.
     * @param detail - why it ended, when the transport said.
     */
    exitTerminalTab(id: string, detail?: string): void;
    /**
     * The connection failed. The tab stays with the reason so the user can read
     * it and close the tab themselves.
     * @param id - the tab id.
     * @param detail - the failure text.
     */
    failTerminalTab(id: string, detail: string): void;
    /**
     * A background close never reached the host. The tab keeps its live session
     * id (so a retry can still end it) and says so instead of vanishing.
     * @param id - the tab id.
     * @param reason - the reason code shown by the view.
     */
    markTerminalCloseFailed(id: string, reason: string): void;
    /**
     * Store the keyboard-interactive challenge this tab has to answer, with a
     * blank answer of this challenge's own length. A prompt on another tab never
     * touches this record, which is what keeps two challenges from sharing input.
     * @param id - the tab id.
     * @param prompt - the challenge the host asked for.
     */
    setTerminalAuthPrompt(id: string, prompt: TerminalAuthPrompt): void;
    /**
     * Record one character typed for this tab's challenge.
     * @param id - the tab id.
     * @param index - which prompt of the challenge.
     * @param value - the field's current text.
     */
    setTerminalAuthAnswer(id: string, index: number, value: string): void;
    /** Drop the challenge once it was answered, cancelled, or could not apply. */
    clearTerminalAuthPrompt(id: string): void;
    /** Choose the alias the next terminal tab opens on. */
    setDraftAlias(alias: string): void;
    /** Append one output chunk to the retained screen of a tab. */
    appendTerminalOutput(id: string, chunk: string): void;
    /** The retained screen of a tab, concatenated for a redraw. */
    readTerminalOutput(id: string): string;
    /** Forget the retained screen (a fresh replay from the host replaces it). */
    clearTerminalOutput(id: string): void;
    /**
     * Keep a still-connecting socket alive after its view went away. The socket
     * cannot be detached yet (no session id), so the intent is applied when the
     * host reports it: `detach` leaves the shell for a later reattach, `close`
     * ends the session of a tab the user closed.
     * @param tabId - the tab the socket belongs to.
     * @param connection - the live connection.
     * @param intent - what to do once the session id arrives.
     */
    adoptTerminalLink(tabId: string, connection: TerminalConnection, intent: TerminalLinkIntent): void;
    /**
     * Take an adopted socket back when its tab is shown again, so the host never
     * opens a second PTY for the same tab.
     * @param tabId - the tab id.
     * @returns the connection, or undefined when nothing was adopted.
     */
    reclaimTerminalLink(tabId: string): TerminalConnection | undefined;
    private commit;
    /** Ask the layout to select a panel; a shell without the face is a no-op. */
    private selectPanel;
}
