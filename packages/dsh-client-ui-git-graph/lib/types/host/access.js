import { isPairedOrLoopbackAllowed } from "./pair-access.js";
/**
 * Whether this request may enter any /git route (JSON operations or SSE).
 * @param ctx - host context; may expose remoteWebUiPairing.
 * @param request - the incoming HTTP request.
 * @returns true for loopback, or a live paired-device cookie.
 */
export function isGitAllowed(ctx, request) {
    return isPairedOrLoopbackAllowed(ctx, request);
}
