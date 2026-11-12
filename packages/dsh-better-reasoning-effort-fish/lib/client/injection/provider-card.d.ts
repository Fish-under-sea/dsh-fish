/**
 * The request-header editor's CARD-INNER injection (issue #12).
 *
 * The editor used to ride the official `settings.models.provider-card` keyed
 * seat. That seat dispatches per provider namespace, and it admits exactly ONE
 * entry per (key, priority) pair — the dsh-web aggregate's model-capabilities
 * plugin registers the same key (`llm-pi-ai`) at the same priority, so the
 * second registration throws and the loser's whole panel disappears without a
 * trace. This module gives the seat back and mounts the editor inside the
 * provider card's own editor container instead, so both plugins keep their
 * surface.
 *
 * The container doubles as the visibility signal: the official card renders
 * its action row only while it is being edited, so "this card has an action
 * row" IS "this card is open". That is why this module needs no `_editor`
 * class probe, no MutationObserver of its own, and no data-attribute dance —
 * the page-wide scan already runs on every mutation burst, and a mount whose
 * container left the document is simply unmounted on the next pass.
 *
 * @module dsh-better-reasoning-effort/client/injection/provider-card
 */
import type { ReactNode } from 'react';
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots';
import type { RemoteApi } from '../types.js';
/** Props the mounted editor renders with. */
export interface HeaderCardProps {
    route: string;
    api: RemoteApi;
    t: Translate;
}
/** One mounted header editor, keyed by the container element it lives in. */
export interface HeaderCardMount {
    /** The foreign root's render/dispose pair. */
    editor: {
        render(props: HeaderCardProps): void;
        unmount(): void;
    };
    /** The route the editor is currently bound to. */
    route: string;
}
/** What the card-inner injection needs from its host. */
export interface HeaderCardDeps {
    /** The write seam the editor reads and writes through. */
    api: RemoteApi;
    /** The plugin's locale-bound translator. */
    t: Translate;
    /** The render-failure boundary's copy (the host's own 'renderFailed'). */
    boundaryText: string;
    /** Wrap a subtree so a language switch re-translates it. */
    refreshed?: (children: () => ReactNode) => ReactNode;
    /** The live mounts, owned by the caller's scan state. */
    mounted: Map<HTMLElement, HeaderCardMount>;
}
/**
 * Resolve the settings route a provider card edits, or undefined when the card
 * cannot name one yet.
 *
 * Three arms, most reliable first:
 *   1. the create card is refused outright (its route is not saved);
 *   2. the official route tag — the host renders it whenever the display name
 *      differs from the route key;
 *   3. the card title — exact while the tag is hidden, because the host hides
 *      the tag exactly when the two are equal. Copy that is not a route key is
 *      refused rather than written as a phantom provider.
 *
 * @param card - the card element holding the editor.
 * @returns the route key, or undefined when none can be trusted.
 */
export declare function routeOfProviderCard(card: HTMLElement): string | undefined;
/**
 * Reconcile the header editors against the cards currently on the page.
 *
 * Idempotent: a card whose editor is already mounted keeps it (re-rendered in
 * place when its route changed), a card that just opened gets one, and a mount
 * whose container left the document — the card was collapsed, or React
 * replaced the row — is unmounted.
 *
 * @param root - the scan root (the settings panel, or the document body).
 * @param deps - the injection dependencies.
 */
export declare function reconcileHeaderCards(root: HTMLElement, deps: HeaderCardDeps): void;
/**
 * Unmount every editor this injection owns (fiber teardown, HMR, plugin
 * disable). The mounts outlive the scan otherwise.
 *
 * @param mounted - the caller's mount map.
 */
export declare function unmountHeaderCards(mounted: Map<HTMLElement, HeaderCardMount>): void;
