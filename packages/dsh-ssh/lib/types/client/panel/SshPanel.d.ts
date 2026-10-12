import type { SshApi } from '../api.ts';
import type { PanelController } from './controller.ts';
import { type TerminalFontSource } from './helpers.ts';
/** Panel shell props. */
export interface SshPanelProps {
    /** The panel state owner (open/close/toggle, active tab, terminal session). */
    controller: PanelController;
    /** The SSH API client every tab operates through. */
    api: SshApi;
    /** Live terminal-font setting source handed to the terminal tab (issue #577). */
    terminalFont?: TerminalFontSource;
}
/** The tabbed SSH panel. */
export declare function SshPanel({ controller, api, terminalFont }: SshPanelProps): import("react").JSX.Element;
