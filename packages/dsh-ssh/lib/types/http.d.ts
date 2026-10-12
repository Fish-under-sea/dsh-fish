/**
 * Shared JSON body/response helpers for the host route families: one strict
 * bounded body reader, one lenient bounded body reader, one JSON object
 * narrow, one JSON writer, and the outbound request-init helper that keeps a
 * host fetch body decodable (withIdentityEncoding). Previously the readers
 * were copy-pasted across the
 * package route files (routes.ts, update-routes.ts, mobile-api.ts, and each
 * family's route module) with drifting contracts: body caps ranging 4 KiB to
 * 1 MiB and four distinct overflow behaviors (reject, undefined, null, throw).
 *
 * Packages receive this file as a generated copy via scripts/sync-shared.mjs;
 * edit this shared source and re-run the sync instead of editing a copy.
 * Consumer code is migrated onto it in follow-up waves; no call site changes
 * belong in the same change as its introduction.
 * @module dsh-web-shared/host/http
 */
import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'node:http';
/**
 * Strict bounded body reader: parse a request body of at most maxBytes as
 * JSON.
 * @throws 'body too large' past the cap, or the JSON.parse error for an
 *   invalid or empty payload.
 */
export declare function readBoundedJson(req: IncomingMessage, maxBytes: number): Promise<unknown>;
/**
 * Lenient bounded body reader: parse a request body as JSON, or null on an
 * empty body, invalid JSON, or a body past maxBytes (default 64 KiB).
 * Overflow destroys the request instead of draining the remainder (no drain
 * call, matching the current repo-wide behavior); callers must not keep
 * reading the request afterwards. With objectOnly, non-JSON-object payloads
 * also yield null.
 */
export declare function readJsonBody(req: IncomingMessage, opts?: {
    maxBytes?: number;
    objectOnly?: boolean;
}): Promise<unknown | null>;
/** Narrow a value to a JSON object, or undefined when it is not one. */
export declare function asJsonObject(value: unknown): Record<string, unknown> | undefined;
/**
 * Request init that asks a remote origin for an uncompressed body.
 *
 * The DSH host boots `@deepseek-ai/dsh-http-proxy`, whose top-level import of
 * the npm `undici` copy replaces the legacy `undici.globalDispatcher.1` slot
 * Node's built-in `fetch()` reads. That cross-major wrapper drops the
 * `content-encoding` header and automatic decompression, so a plain fetch
 * resolves to raw gzip/brotli/zstd bytes — compressed noise no JSON or text
 * consumer can read. Every host fetch that parses a remote body must request
 * identity encoding. Caller headers survive; `accept-encoding` is forced to
 * `identity` because a caller value has no decoder behind it in this host.
 * @param init - the caller's request init (signal, headers, method, ...).
 * @returns a copy with `accept-encoding: identity` merged in.
 */
export declare function withIdentityEncoding(init?: RequestInit): RequestInit;
/**
 * Write one JSON response. Default headers are the family defaults
 * (content-type and referrer-policy); caller headers are appended or
 * override them.
 */
export declare function writeJson(res: ServerResponse, status: number, body: unknown, headers?: OutgoingHttpHeaders): void;
