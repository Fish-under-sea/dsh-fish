/**
 * Family plugin-card seat.
 *
 * A family plugin contributes its settings card to whichever plugin-card seat
 * the running host actually renders:
 *
 * - `web-ui.plugin.item` — the list seat declared by the dsh-web-settings
 *   group section (this family's own first-level "Web UI plugins" section);
 * - `plugins.bundle.config` — the official keyed seat of the harness's plugin
 *   manager page, keyed by the bundle's package name and rendered on that
 *   bundle's page. alpha.2 removed the `settings.plugin.item` keyed seat of the
 *   `ui-settings-plugins` tab that this helper used before, so a card keyed by
 *   its settings namespace has no seat to land in any more.
 *
 * SEAT SELECTION IS NOT A DECLARATION PROBE. The official plugin surface
 * belongs to the harness bundle and declares its seats before any external
 * plugin's `apply()` runs, so "is the official seat declared?" answers yes even
 * in the deployment whose whole point is the family group. Choosing on that
 * probe sends every family card to the official page and leaves the group's own
 * section permanently empty — the family of reports where the section renders
 * its heading and zero cards.
 *
 * The signal that actually distinguishes the two deployments is whether
 * dsh-web-settings is loaded: it is the package that owns the group section and
 * it publishes the `webUiSettings` service during `apply()`, which every
 * family plugin already reads for its settings form. Group loaded -> the family
 * seat; group absent -> the official seat.
 *
 * The decision is re-evaluated on every `slots/changed` because the group may
 * apply after this plugin (the family aggregate orders it first, a profile that
 * installs the group separately need not): the initial contribution goes to the
 * official seat, then moves to the family seat the moment the group's section
 * registers. The entry is disposed before the replacement is registered, so a
 * card is never in two seats at once.
 *
 * The shared tree has no client-SDK dependency, so this module reads its
 * context through the structural shape below; callers pass the plugin's own
 * `ctx`.
 */
/** The family list seat key. */
export declare const FAMILY_PLUGIN_CARD_SEAT = "web-ui.plugin.item";
/** The official keyed plugin-card seat key (the alpha.2 bundle-configuration seat). */
export declare const OFFICIAL_PLUGIN_CARD_SEAT = "plugins.bundle.config";
/** The service dsh-web-settings publishes while it is loaded. */
export declare const FAMILY_GROUP_SERVICE = "webUiSettings";
/** The slot-registry member this helper uses (structurally satisfied by ctx.slots). */
export interface PluginCardSlots {
    /** Contribution of one card entry. */
    register(options: never, component: never): unknown;
}
/** The slice of the client context a card contribution needs. */
export interface PluginCardContext {
    slots: PluginCardSlots;
    /** Service lookup; absent on a context double that only models the slots. */
    get?(name: string): unknown;
    /** Event subscription seat; absent on an event-less test double. */
    on?(event: string, listener: (...args: never[]) => void): unknown;
}
/** Owner share of a family list-seat card (that seat supplies nothing). */
export interface SettingsPluginItemOwnerProps {
    /** Marker field: card owner props are intentionally empty. */
    children?: never;
}
/** One family plugin's card contribution. */
export interface PluginCardSeat {
    /**
     * Npm package name of the bundle this card configures; the official keyed
     * seat dispatches on it. Every family package ships its own bundle patch, so
     * a standalone install lists that package as the bundle whose page renders
     * this card.
     */
    bundle: string;
    /** Family list-seat entry id. */
    id: string;
    /** Family list-seat sort order. */
    order?: number;
    /** Family list-seat display label; the official keyed seat carries none. */
    label?: () => string;
    /** Locale namespace the card renders with. */
    locale: string;
    /**
     * Child slots this card declares and renders. Forwarded to whichever seat
     * the host renders; absent for a card that declares none.
     */
    children?: Record<string, unknown>;
    /** Business-face factory of the registration. */
    inject?: () => object;
    /**
     * The card component. Its props type is the seat's composed shape, which is
     * chosen at runtime, so the helper takes it erased; the registrant keeps its
     * own precise typing at the call site.
     */
    component: unknown;
}
/**
 * Whether the family group (dsh-web-settings) is loaded in this page. The
 * service is the group package's own contract, so the probe cannot be fooled
 * by a harness release that starts declaring the official seat differently.
 */
export declare function familyGroupLoaded(ctx: PluginCardContext): boolean;
/**
 * Contribute one family plugin card to the seat this host renders, following
 * the group if it loads later. The entry is disposed and re-registered on a
 * seat change, never duplicated.
 * @param ctx - client context (its slot registry decides the seat).
 * @param seat - the card contribution.
 */
export declare function installPluginCard(ctx: PluginCardContext, seat: PluginCardSeat): void;
