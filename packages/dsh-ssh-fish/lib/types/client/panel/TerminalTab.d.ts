import type { SshApi } from '../api.ts';
import type { PanelController } from './controller.ts';
import { type TerminalFontSource } from './helpers.ts';
/** Terminal tab props. */
export interface TerminalTabProps {
    api: SshApi;
    /** The panel controller that owns the tabs and their host session ids. */
    controller: PanelController;
    /** Alias preselected by a "connect" action from the hosts tab. */
    presetAlias?: string;
    /**
     * Live terminal-font setting source (issue #577). Absent in tests and
     * legacy mounts: the font then comes from the CSS custom-property chain.
     */
    terminalFont?: TerminalFontSource;
}
/**
 * Whether the visible challenge form may answer on the bound socket: the form
 * and the socket must belong to the same tab. Both are read at submit time, and
 * the window between a tab switch's commit and the effect that rebinds the
 * socket is exactly when they can disagree.
 * @param linkTabId - the tab the bound socket belongs to.
 * @param formTabId - the tab whose challenge form is on screen.
 */
export declare function challengeBelongsToLink(linkTabId: string | undefined, formTabId: string | undefined): boolean;
/** The terminal view with its tab strip. */
export declare function TerminalTab({ api, controller, presetAlias, terminalFont }: TerminalTabProps): import("react").JSX.Element;
