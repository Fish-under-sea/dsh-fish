/**
 * One `document.body` MutationObserver per page, shared by every family
 * plugin bundle.
 *
 * Family plugins that inject at the DOM level must notice when the shell
 * re-renders around their injected node: the aggregate shell's column shims
 * and any plugin surface still extending the shell from outside the official
 * slot seats. Each consumer used to install its OWN `MutationObserver` on
 * `document.body` with
 * `{ childList: true, subtree: true }`, so a page carrying N family plugins
 * paid N native observers and N callback invocations for EVERY mutation batch
 * the app produced — chat token streaming alone produces many per second, and
 * the count grows with the number of installed plugins.
 *
 * This module keeps exactly ONE body observer per page. The registry lives on
 * `globalThis` under a `Symbol.for` key, so the per-package generated copies
 * of this file (scripts/sync-shared.mjs) and separately bundled plugins all
 * reach the same hub at runtime instead of one hub per module instance.
 * Record subscribers receive the mutations accumulated since the last flush.
 * Consumers that only re-check their DOM use subscribeBodyInvalidations:
 * when all subscribers use that path, the hub retains no mutation records
 * (or detached subtrees) while a background page's animation frames pause.
 * Both paths run at most once per frame. The last subscriber disconnects the
 * observer, cancels the pending frame and releases its records.
 *
 * Failure policy: without a DOM or `MutationObserver` the subscription is a
 * no-op disposer (the same silence the per-consumer observers had), and when
 * `requestAnimationFrame` is unavailable the flush runs synchronously so a
 * subscriber is never silently dropped. A throwing subscriber cannot stop the
 * others.
 */
/**
 * Subscribe to a coalesced DOM re-check without retaining mutation records.
 * The marked wrapper also works with an older hub, which delivers records
 * that it simply ignores until a page reload picks up the updated hub.
 */
export declare function subscribeBodyInvalidations(subscriber: () => void): () => void;
/**
 * Subscribe to body-level childList mutations.
 * @param subscriber - called at most once per animation frame with the records
 *   collected since the previous flush; must be safe to run repeatedly.
 * @returns the disposer removing this subscriber (and the observer when it was
 *   the last one).
 */
export declare function subscribeBodyMutations(subscriber: (records: MutationRecord[]) => void): () => void;
