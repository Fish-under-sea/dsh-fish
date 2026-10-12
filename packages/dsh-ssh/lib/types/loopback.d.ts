/**
 * Loopback trust fence shared by the host route families: socket address,
 * Host header, and browser same-origin markers. Packages receive this file as
 * a generated copy via scripts/sync-shared.mjs; edit the shared source and
 * re-run the sync instead of editing a copy.
 *
 * Semantics: RFC 5735 IPv4 127/8, ::1, IPv4-mapped ::ffff:127/8 (matching the
 * remote-web-ui gate), localhost hostnames, plus the browser same-origin
 * markers (sec-fetch-site and Origin) for the request-level fence.
 * @module dsh-web-shared/host/loopback
 */
import type { IncomingMessage } from 'node:http';
/** IPv4 127/8 predicate (four decimal octets, first == 127). */
export declare function isIPv4Loopback(v4: string): boolean;
/** Whether a socket remote address names the loopback range (127/8, ::1, IPv4-mapped). */
export declare function isLoopbackAddress(address: string | undefined): boolean;
/** Whether a normalized URL hostname names the loopback authority (localhost, [::1], 127/8). */
export declare function isLoopbackHostname(hostname: string): boolean;
/**
 * Request-level trust fence: a loopback socket address AND a loopback Host
 * header, plus browser same-origin markers. The socket address is
 * authoritative; X-Forwarded-For is never trusted.
 */
export declare function isLoopbackRequest(request: IncomingMessage): boolean;
