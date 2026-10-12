/**
 * Pairing trust fence shared by plugins that expose host routes: loopback
 * (the desktop) always passes; a live paired-device cookie is an additional
 * allow path when remote-web-ui is loaded. The consuming plugin never
 * depends on that plugin — without the service the fence stays
 * loopback-only.
 *
 * Per-package wrappers (access.ts) call this with their own name so each
 * plugin keeps a self-describing export; the security decision lives only
 * here.
 */
import type { IncomingMessage } from 'node:http';
/** Structural pairing lookup (no package dependency on remote-web-ui). */
interface PairingAccess {
    isPairedDevice(request: IncomingMessage): boolean;
}
/**
 * Structural host-context shape: shared sources carry no @deepseek-ai
 * dependency (the shared package must typecheck standalone), so the fence
 * reads only the two members it needs; cordis Context satisfies this.
 * ctx.get is optional on the test harness; production Context always has it.
 */
interface LookupCtx {
    get?(name: string, strict?: boolean): unknown;
    remoteWebUiPairing?: PairingAccess;
}
/**
 * Whether this request may enter the plugin's host routes.
 * @param ctx - host context; may expose remoteWebUiPairing.
 * @param request - the incoming HTTP request.
 * @returns true for loopback, or a live paired-device cookie.
 */
export declare function isPairedOrLoopbackAllowed(ctx: LookupCtx, request: IncomingMessage): boolean;
export {};
//# sourceMappingURL=pair-access.d.ts.map