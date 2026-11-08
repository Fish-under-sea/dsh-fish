/**
 * Loopback trust fence shared by the host route families: socket address,
 * Host header, and browser same-origin markers. Packages receive this file as
 * a generated copy via scripts/sync-shared.mjs; edit the shared source and
 * re-run the sync instead of editing a copy.
 *
 * Semantics: RFC 5735 IPv4 127/8, ::1, IPv4-mapped ::ffff:127/8 (matching the
 * remote-web-ui gate), localhost hostnames, plus the browser same-origin
 * markers (sec-fetch-site and Origin) for the request-level fence.
 *
 * A reverse proxy in front of the host rewrites the Host header to its own
 * upstream literal (a Cloudflare tunnel, frp and an nginx reverse proxy all
 * dial 127.0.0.1:<port>), and the socket the origin sees is the proxy's, which
 * is loopback by construction. Both halves of the fence then hold for a public
 * request. Forwarding headers are the signal that a hop stands in between: a
 * request that carries CF-Connecting-IP or X-Forwarded-For is answered through
 * a proxy and is never treated as a local one (issue #1906).
 *
 * An operator who runs that proxy or tunnel themselves can opt into the
 * narrower case: isForwardedLoopbackRequest describes a forwarded request that
 * still landed on this machine's loopback upstream, and a route family admits
 * it only behind its own default-off switch (issue #1918).
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
 * Whether a reverse proxy stood between the client and this host: the request
 * carries CF-Connecting-IP or X-Forwarded-For. Either header is stamped by a
 * hop that forwards traffic, so the request did not originate on this machine.
 * @param request - node HTTP request.
 * @returns true when a forwarding header is present.
 */
export declare function isProxiedRequest(request: IncomingMessage): boolean;
/**
 * Request-level trust fence: a loopback socket address AND a loopback Host
 * header, plus browser same-origin markers. The socket address is
 * authoritative for a direct connection; a request that carries a forwarding
 * header is refused outright, because a proxy in front of the host makes both
 * the socket address and the Host header describe the proxy rather than the
 * client. X-Forwarded-For is therefore never evidence *for* loopback.
 */
export declare function isLoopbackRequest(request: IncomingMessage): boolean;
/**
 * Whether a forwarded request landed on this machine's loopback upstream: a
 * forwarding header (the proxy's own stamp), a loopback socket address (the
 * proxy dials 127.0.0.1:<port>), and a loopback Host header (the proxy rewrote
 * the authority to its upstream literal).
 *
 * This is a fact about the route, not a trust decision. A public request to a
 * tunnel satisfies all three by construction, because the proxy is the client
 * of this process: only a caller that operates the proxy can decide it stands
 * for the browser, which is why every consumer keeps this behind an explicit
 * default-off switch and its own browser markers. isLoopbackRequest is
 * unchanged and still refuses a forwarded request (issue #1906).
 * @param request - node HTTP request.
 * @returns true when a forwarding header, a loopback socket, and a loopback Host all hold.
 */
export declare function isForwardedLoopbackRequest(request: IncomingMessage): boolean;
