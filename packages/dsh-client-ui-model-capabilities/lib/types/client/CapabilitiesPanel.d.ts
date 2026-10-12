/**
 * Models-page provider-card extension area: per-model capability declarations
 * and the provider disable/enable toggle for one pi-ai provider route.
 *
 * The slot owner passes the card's directory row (`provider.settingsNs` /
 * `provider.settingsPath` address the profile inside the settings document)
 * and the apply body injects the settings namespace face plus the refresh
 * bus; this panel reads the redacted entry views over the remote settings
 * wire, drafts reasoning-effort declarations per model, and saves them as one
 * whole-array path op with revision fencing — the same write granularity and
 * conflict posture the official card uses. Model input types belong to the
 * Models page's own editor since 0.1.6-alpha.2, so the draft preserves the
 * `input` claim instead of rewriting it.
 *
 * The toggle uses this plugin's own settings entry: disabling stashes the
 * user-layer profile and unsets `providers.<route>` (the official
 * Remove-provider seam), which takes the provider out of the model catalog
 * both pickers read; enabling restores it. A missing entry or a refused
 * read renders the failure inline, never a blank.
 * @module @fish-under-sea/dsh-client-ui-model-capabilities/client/CapabilitiesPanel
 */
import type { ProviderCardExtrasOwnerProps } from '@deepseek-ai/dsh-client-ui-settings-models/client';
import type { SettingsNamespaceFace } from './settings-face.ts';
export type { SettingsNamespaceFace } from './settings-face.ts';
import type { RefreshBus } from './settings-face.ts';
/** Component props: the slot's owner share plus the injected faces. */
export interface CapabilitiesPanelProps extends ProviderCardExtrasOwnerProps {
    /** The generated remote settings namespace (extracted by the apply body, which declares the dotted inject). */
    settings: SettingsNamespaceFace;
    /** Cross-surface refresh bus plus the surface for disable/enable; absent keeps the capability editor only. */
    refresh?: RefreshBus;
}
/**
 * Render the capability editor for one provider card.
 * @param props - the card's directory row, its configured facts, and the injected faces.
 * @returns the extension area.
 */
export declare function CapabilitiesPanel(props: CapabilitiesPanelProps): import("react").JSX.Element;
