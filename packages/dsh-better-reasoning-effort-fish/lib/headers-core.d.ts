/**
 * Provider request-header overlay, PURE half: the origin index and the header
 * value rules shared by the fetch-layer installer and the conflict report.
 *
 * Why this exists at all (issue #12): a route's `headers` dict reaches the wire
 * through the official adapter, but `user-agent` does not. The pi-ai adapter
 * merges `attributionHeaders()` over the profile's dict and drops the profile's
 * own `user-agent` first, so a gateway that fingerprints the client identity
 * (agentrouter and claude-code-router style relays) never sees the configured
 * value. No configuration field can express that override, so the plugin takes
 * it over at the fetch layer.
 *
 * The index is keyed by ORIGIN, deliberately: the fetch seam sees a URL and
 * nothing else, and unlike a substring match an origin compare cannot be
 * fooled by `http://host` matching `http://host.example` or by two loopback
 * ports bleeding into each other.
 *
 * @module dsh-better-reasoning-effort/headers-core
 */
/** One origin's user-agent override, with the route that produced it. */
export interface UserAgentOverride {
    /** `scheme://host:port` of the route's endpoint, exactly as Fetch would print it. */
    origin: string;
    /** The configured `user-agent` value. */
    userAgent: string;
    /** The route key that declared it (diagnostics and the UI's own labelling). */
    route: string;
}
/** The origin index plus what could not be indexed. */
export interface UserAgentIndex {
    /** origin → override, first declarer wins (see {@link conflicts}). */
    byOrigin: Map<string, UserAgentOverride>;
    /**
     * Origins two or more routes claim with DIFFERENT values. The index keeps the
     * first and reports the rest: silently picking one would make the other
     * route's UA a coin flip, and the fetch layer has no way to tell the two
     * requests apart.
     */
    conflicts: {
        origin: string;
        routes: string[];
        values: string[];
    }[];
}
/** An empty index, for the "no route declares a UA" case. */
export declare function emptyIndex(): UserAgentIndex;
/** The `scheme://host:port` of a URL string, or undefined when unparseable. */
export declare function originOf(url: string | undefined): string | undefined;
/**
 * Whether a configured value can ride a Fetch `user-agent` field. Refused
 * rather than sanitized: a header carrying a newline is a request-splitting
 * hazard, and quietly rewriting the user's value would send something they
 * never asked for.
 * @param value - the configured header value.
 * @returns whether it is safe to `Headers.set()`.
 */
export declare function isSendableUserAgent(value: string): boolean;
/** The `headers` dict of one route profile, as string pairs, or undefined. */
export declare function headersOf(profile: Record<string, unknown> | undefined): Record<string, string> | undefined;
/**
 * The `user-agent` a route's `headers` dict declares, case-insensitively.
 *
 * A `user-agent` stored here is the user's DECLARATION of the identity their
 * gateway wants, even though the official adapter discards it; the plugin reads
 * the same key so the settings document stays the single source of truth.
 * @param profile - one route's profile record.
 * @returns the value, or undefined when the route declares none.
 */
export declare function declaredUserAgent(profile: Record<string, unknown> | undefined): string | undefined;
/**
 * Build the origin index from the resolved `providers` dict of the pi-ai
 * namespace.
 *
 * Only routes that both name an endpoint and declare a sendable `user-agent`
 * enter the index: a route with no `baseURL` resolves to a catalog endpoint the
 * plugin cannot know from settings, and inventing a value for it would rewrite
 * requests the user never configured.
 * @param providers - the `llm-pi-ai` providers dict, as stored.
 * @returns the index plus any same-origin disagreements.
 */
export declare function buildUserAgentIndex(providers: Record<string, Record<string, unknown>>): UserAgentIndex;
/**
 * The request URL a Fetch call is aimed at, or undefined when it cannot be
 * classified. A `Request` from another realm fails the `instanceof` test and is
 * reported as unclassifiable rather than mis-read — the same conservative
 * posture the official fetch seam takes.
 * @param input - the fetch input.
 * @returns the URL string, when one can be read.
 */
export declare function requestUrlOf(input: unknown): string | undefined;
