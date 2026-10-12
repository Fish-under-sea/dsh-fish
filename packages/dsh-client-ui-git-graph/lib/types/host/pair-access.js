import { isLoopbackRequest } from "./loopback.js";
/**
 * Whether this request may enter the plugin's host routes.
 * @param ctx - host context; may expose remoteWebUiPairing.
 * @param request - the incoming HTTP request.
 * @returns true for loopback, or a live paired-device cookie.
 */
export function isPairedOrLoopbackAllowed(ctx, request) {
    if (isLoopbackRequest(request))
        return true;
    const fromGet = typeof ctx.get === 'function' ? ctx.get('remoteWebUiPairing', false) : undefined;
    const pairing = (isPairingAccess(fromGet) ? fromGet : ctx.remoteWebUiPairing);
    return pairing?.isPairedDevice(request) === true;
}
function isPairingAccess(value) {
    return value !== undefined
        && value !== null
        && typeof value.isPairedDevice === 'function';
}
