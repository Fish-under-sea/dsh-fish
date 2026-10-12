/**
 * Package-owned invariant companion for `@fish-under-sea/dsh-client-ui-git-graph`.
 * Not mounted by the bundle patch (the web profile composes no invariants
 * service); kept as the repo-convention companion for compositions that do.
 * @module @fish-under-sea/dsh-client-ui-git-graph/invariant
 */
const PACKAGE_NAME = '@fish-under-sea/dsh-client-ui-git-graph';
/** Cordis companion plugin name. */
export const name = 'git-graph-invariant';
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants'];
/**
 * No runtime invariant: the plugin owns no durable package-local event
 * stream — git state is external to the harness log by design (UI-triggered
 * host operations, not model-visible facts); service tests cover the guard
 * and gate contracts.
 */
const install = () => { };
/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
/* jscpd:ignore-end */
