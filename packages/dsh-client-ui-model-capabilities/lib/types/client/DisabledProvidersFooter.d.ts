/**
 * Models-page footer extension area: the disabled-provider archive listing.
 *
 * A disabled provider's route is unregistered, so for hand-declared routes
 * the provider card itself disappears from the Models page; this footer (the
 * page's `settings.models.footer` seat) is where those providers come back:
 * it lists the archive entries whose route is still down and restores a profile
 * on enable. Renders nothing while no such entry exists.
 * @module @fish-under-sea/dsh-client-ui-model-capabilities/client/DisabledProvidersFooter
 */
import type { ProviderCardSeatStore } from './provider-card-seat.ts';
import type { RefreshBus, SettingsNamespaceFace } from './settings-face.ts';
/** Component props: the injected settings face, refresh bus and card-seat status. */
export interface DisabledProvidersFooterProps {
    /** The generated remote settings namespace (extracted by the apply body). */
    settings: SettingsNamespaceFace;
    /** Cross-surface refresh bus (a card-side toggle updates this listing). */
    refresh: RefreshBus;
    /**
     * Claim status of the provider-card cell. This Models-page footer is the one
     * surface of this plugin that still renders when another registrant holds
     * that cell, so it is where the collision becomes visible to the user.
     */
    cardSeat: ProviderCardSeatStore;
}
/**
 * Render the disabled-provider archive.
 * @param props - the injected settings face, refresh bus and card-seat claim status.
 * @returns the footer area, the card-collision notice on its own, or nothing while neither applies.
 */
export declare function DisabledProvidersFooter(props: DisabledProvidersFooterProps): import("react").JSX.Element | null;
