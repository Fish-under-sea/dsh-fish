/**
 * The composer model menu injection: the reasoning-effort slider mounted
 * inside the OFFICIAL model menu opened from the bottom-right seat. The seat's
 * trigger is never touched — the official "model · effort" display stays.
 *
 * This module owns two decisions: where the slider's foreign body sits, and
 * whether the official pane currently showing is a drill-in. The model list
 * and the effort list both render `[role="menuitemradio"]` rows and both
 * replace the root cells, so the replica retires while either is open and the
 * official pane is the only content.
 *
 * @module dsh-better-reasoning-effort/client/injection/composer-menu
 */
import type { ReactNode } from 'react';
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots';
import type { ModelDirectoryLike } from '../types.js';
/** Everything the composer injection needs from its host. */
export interface ComposerMenuDeps {
    /** The official menu element, or undefined while it is closed. */
    menuOf: () => HTMLElement | undefined;
    /** The plugin's locale-bound translator. */
    t: Translate;
    /** Wrap a subtree so it re-translates on a language switch. */
    refreshed: (children: () => ReactNode) => ReactNode;
    /** Whether the composer slider preference is on. */
    sliderEnabled: () => boolean;
    /** The current session's model directory, or undefined in the boot window. */
    directory: () => ModelDirectoryLike | undefined;
}
/** The composer injection's face: one reconcile per scan, one dispose per fiber. */
export interface ComposerMenuInjection {
    /** Mount/reposition/retire the foreign root (idempotent, mutation-cheap). */
    reconcile: () => void;
    /** Unmount the root; the fiber is going away. */
    dispose: () => void;
}
/**
 * Build the composer menu injection.
 * @param deps - menu lookup, copy, locale refresh, preference and directory.
 * @returns the injection's {@link ComposerMenuInjection} face.
 */
export declare function createComposerMenu(deps: ComposerMenuDeps): ComposerMenuInjection;
