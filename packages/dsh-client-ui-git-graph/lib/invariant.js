//#region src/invariant.ts
const PACKAGE_NAME = "@fish-under-sea/dsh-client-ui-git-graph";
/** Cordis companion plugin name. */
const name = "git-graph-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/**
* No runtime invariant: the plugin owns no durable package-local event
* stream — git state is external to the harness log by design (UI-triggered
* host operations, not model-visible facts); service tests cover the guard
* and gate contracts.
*/
const install = () => {};
/**
* Register this package's invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns the installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
