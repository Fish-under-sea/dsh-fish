/**
 * The Models page's provider-card seat claim for the pi-ai adapter family.
 *
 * `settings.models.provider-card` is a KEYED slot: the Models page dispatches
 * one extension area per provider settings namespace, and a cell renders
 * exactly one entry. The core registry refuses a second registration into an
 * occupied cell (same key, same priority) by throwing — the right default, but
 * it makes the loser of a collision silently invisible unless it reports the
 * refusal. Two unrelated plugins that both extend pi-ai provider cards (this
 * one and a third-party auth plugin, for example) therefore cannot both
 * render, and the reporter must be able to see that.
 *
 * This module owns that outcome so it is never a silent blank:
 *
 * - a refused claim is classified and reported (console plus a status the
 *   Models page renders), naming the registrant that holds the cell;
 * - the claim is retried on every change to that slot, so disabling the
 *   occupying plugin restores this panel without a DSH restart;
 * - the retry subscription lives inside the injected declaration's lifetime,
 *   so fiber unload and declaration collapse both release it.
 *
 * The panel deliberately keeps the default priority rather than picking a
 * distinct one: entries sharing a cell at DIFFERENT priorities coexist on the
 * ledger but only the lowest renders, which would replace a loud collision
 * with a silent shadowing of the other plugin.
 *
 * The shared tree has no client-SDK dependency, so this module reads its
 * context through the structural shape below; callers pass the plugin's own
 * `ctx`.
 * @module @fish-under-sea/dsh-client-ui-model-capabilities/client/provider-card-seat
 */
/** The Models page seat this plugin fills for pi-ai provider cards. */
export declare const PROVIDER_CARD_SEAT = "settings.models.provider-card";
/** The adapter-family settings namespace whose cards carry the panel. */
export declare const PI_AI_PROVIDER_CARD_KEY = "llm-pi-ai";
/**
 * Live state of this plugin's claim on the provider-card cell.
 *
 * - `unclaimed` — no panel seated: the host declares no such seat, the claim
 *   was released, or the plugin is unloading;
 * - `claimed` — this plugin holds the cell, so every pi-ai provider card
 *   renders the capability area;
 * - `conflict` — another registrant holds the cell, so this panel does not
 *   render. `occupant` names that registrant when the registry recorded one.
 */
export type ProviderCardSeatStatus = {
    kind: 'unclaimed';
} | {
    kind: 'claimed';
} | {
    kind: 'conflict';
    occupant: string | undefined;
};
/** Observable claim status, shaped for `useSyncExternalStore`. */
export interface ProviderCardSeatStore {
    /** Subscribe to status transitions; returns the unsubscribe function. */
    subscribe(listener: () => void): () => void;
    /** Current status, a stable reference between transitions. */
    getSnapshot(): ProviderCardSeatStatus;
}
/**
 * The slot-registry members this module uses (structurally satisfied by
 * `ctx.slots`; `never` parameters keep the registry's real overloads
 * assignable, the same trick the shared plugin-card seat helper uses).
 */
export interface ProviderCardSlots {
    /** Contribution of one panel entry. */
    register(options: never, component: never): () => void;
    /** Wait for one slot declaration, running the callback per declaration lifetime. */
    inject(seat: never, callback: () => (() => void)): unknown;
    /** Registration changes of one slot, microtask-batched. */
    subscribe(seat: never, listener: () => void): () => void;
    /** Raw ledger of one slot: the inspection surface, shadowed entries included. */
    entries(seat: never): readonly unknown[];
}
/** The slice of the client context a provider-card claim needs. */
export interface ProviderCardSeatContext {
    slots: ProviderCardSlots;
}
/** One panel contribution to the provider-card cell. */
export interface ProviderCardSeatOptions {
    /**
     * The panel component. Its props type is the seat's composed shape, which is
     * chosen at runtime, so this module takes it erased; the registration site
     * keeps its own precise typing.
     */
    component: unknown;
    /** Business-face factory handed to the panel as its injected share. */
    inject?: () => object;
}
/**
 * The registry's diagnostics label of whoever holds the pi-ai cell.
 *
 * Best-effort by design: a registry that refuses the inspection still lets the
 * refusal be reported, just without the occupant's name.
 * @param ctx - client context owning the registry.
 * @returns the occupant's label, or undefined when unknown or absent.
 */
export declare function providerCardOccupant(ctx: ProviderCardSeatContext): string | undefined;
/**
 * Claim the pi-ai provider-card cell: report a refusal instead of swallowing
 * it, and take the cell back as soon as it is released.
 * @param ctx - client context (its slot registry owns the cell).
 * @param seat - the panel contribution.
 * @returns observable claim status for a user-visible notice.
 */
export declare function claimProviderCardSeat(ctx: ProviderCardSeatContext, seat: ProviderCardSeatOptions): ProviderCardSeatStore;
