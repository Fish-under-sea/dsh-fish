/**
 * Provider adapters: one entry per provider family this plugin can query for
 * a pay-as-you-go balance or a coding-plan quota. Adapters are pure — they
 * build an HTTP probe from a resolved credential and parse the response — so
 * the service stays transport-only and every endpoint detail lives here.
 *
 * All probes run host-side (Node fetch); API keys never reach the browser.
 * @module @fish-under-sea/dsh-usage/core/adapters
 */
import type { PlanWindowView } from './types.ts';
/** One HTTP probe the service executes verbatim. */
export interface ProbeSpec {
    url: string;
    headers: Record<string, string>;
}
/** Inputs an adapter may use to build a probe. */
export interface AdapterProbeContext {
    /** Resolved credential value: a raw API key, or an OAuth access token for the oauth-aware adapters. */
    apiKey: string;
    /** Provider account id riding a dedicated header, when the credential carries one (Codex). */
    accountId?: string;
    /**
     * The route's configured base URL (the pi-ai profile's baseURL), when it
     * declares one. An adapter whose endpoint belongs to one provider origin
     * uses it to refuse an account that merely shares the route key, so a
     * differently-hosted model of the same family is never reported with the
     * other account's number.
     */
    baseURL?: string;
}
/** A parsed balance fact. */
export interface BalanceParse {
    currency: string;
    totalBalance: string;
}
/** A parsed plan-quota fact. */
export interface PlanParse {
    planName?: string;
    windows: PlanWindowView[];
}
/** One provider family's probing capability. */
export interface ProviderAdapter {
    /** Provider route keys this adapter serves. */
    ids: readonly string[];
    /**
     * Route keys that belong to this family for accounting (token folding, the
     * spend price book, the whale-yuan bank) but must never be probed with this
     * adapter's endpoints.
     *
     * A route reaches the DeepSeek family without an API key when the user is
     * signed in to a DeepSeek account: the llm-deepseek-account plugin registers
     * the route id deepseek-account, which authenticates with the account token
     * rather than a key. Its tokens bill the same account the official route
     * bills, so the family must own it, but the balance endpoint reads an
     * API-key account: probing it would either fail on the account token or,
     * when the user also configured DEEPSEEK_API_KEY, print the API-key account's
     * money under the account route's name (issue #1772, the same
     * mis-attribution class as #1688). adapterFor() deliberately does not
     * resolve these ids, so no probe, credential fallback, or alias fold can
     * reach them; family membership is read through isDeepSeekProviderRoute().
     */
    familyOnlyIds?: readonly string[];
    /** Fallback display name when the LLM runtime has none. */
    displayName: string;
    balance?: {
        /**
         * Origin (scheme + host) whose account this balance endpoint reports.
         * Omitted when the endpoint is per-route by construction (a profile
         * supplies the host) or when the provider has only one origin. When set,
         * a route whose configured baseURL resolves elsewhere is not this
         * origin's account and must not be probed with this adapter.
         */
        origin?: string;
        build(context: AdapterProbeContext): ProbeSpec;
        parse(status: number, body: unknown): BalanceParse | undefined;
    };
    plan?: {
        build(context: AdapterProbeContext): ProbeSpec;
        parse(status: number, body: unknown): PlanParse | undefined;
    };
}
/**
 * The official pay-as-you-go balance. `deepseek` is the configurable-catalog
 * route key; `deepseek-official` is the live provider route the llm-deepseek
 * adapter registers (sessions and agent-default-model carry it), so both ids
 * must resolve here or the current provider would never be probed.
 */
/** The official DeepSeek API origin: the only account its balance endpoint reports. */
export declare const DEEPSEEK_API_ORIGIN = "https://api.deepseek.com";
/**
 * The adapter registry, in no particular order. Route keys come from the
 * pi-ai provider catalog plus the routes this deployment observed in user
 * configuration (`zenmux`).
 */
export declare const PROVIDER_ADAPTERS: readonly ProviderAdapter[];
/** Find the adapter serving a provider route key, if any. */
export declare function adapterFor(provider: string): ProviderAdapter | undefined;
/** Origin of a configured base URL, or undefined when it cannot be parsed. */
export declare function originOf(baseURL: string | undefined): string | undefined;
/**
 * Whether an adapter's balance endpoint reports THIS route's account.
 *
 * Some adapter families share one route key across providers that merely
 * speak the same API: `deepseek` is both the official DeepSeek catalog entry
 * and a common id for an OpenAI-compatible reseller (Alibaba Bailian, ...)
 * pointed at another host by the profile's `baseURL`. The balance endpoint is
 * per ORIGIN, not per route key, so probing the official endpoint for a
 * reseller profile reports the official account's money under the reseller's
 * name (issue #1688). An adapter published with a fixed `origin` therefore
 * only applies to a route whose configured base URL is that origin, or to a
 * route that pins no base URL at all (the catalog alias of the official
 * route, which resolves the family's own credential).
 *
 * @param adapter - the matched adapter.
 * @param baseURL - the route's configured base URL (pi-ai profile), if any.
 * @returns true when the adapter may probe its balance endpoint for the route.
 */
export declare function balanceAppliesToRoute(adapter: ProviderAdapter, baseURL: string | undefined): boolean;
/**
 * Whether a provider route belongs to the official DeepSeek family: the only
 * family with a spend price book and a settings-section-owned env credential
 * (llm-deepseek) rather than a pi-ai profile. Drives the fold-time cost
 * stamping, the client fold-time spend estimate, and the whale-yuan bank.
 *
 * Family membership is wider than the probe directory. The account route
 * (deepseek-account) bills the same account but authenticates with the account
 * token, so it prices and mints while `adapterFor()` still returns undefined
 * for it and no probe or env-credential fallback can reach it. Every caller of
 * this predicate is an accounting decision; the credential and probing
 * decisions read `adapterFor()` instead, so the two never widen together
 * (issue #1772).
 */
export declare function isDeepSeekProviderRoute(provider: string): boolean;
/**
 * Whether one ledger model id denotes a DeepSeek model, whichever route served
 * it. Consumption of a DeepSeek model through an aggregator or a relay is still
 * DeepSeek consumption, so the Token Bank's price-book scenario counts it — the
 * route-family predicate alone only ever sees the official account.
 *
 * The match is deliberately narrow: `deepseek` must appear in the id. Every
 * real naming observed in this machine's ledger keeps the vendor token —
 * `deepseek-v4.1-flash` (bailian), `loomy/DeepSeek-V4.1-Flash` (a relay),
 * `our-free-model/deepseek-ai/deepseek-v4.1-flash` — and the official routes log
 * `deepseek-flash`.
 */
export declare function isDeepSeekModelId(model: string): boolean;
/**
 * Whether one ledger row (route + model) counts as DeepSeek consumption. The
 * route clause keeps an official route honest even if it ever logged a model id
 * without the vendor token; the model clause is what reaches relay and
 * aggregator traffic.
 */
export declare function countsAsDeepSeekUsage(provider: string, model: string): boolean;
/**
 * Best-effort human message from a provider error body, for the per-provider
 * error line. Never throws; truncated to one short sentence.
 */
export declare function providerErrorMessage(status: number, body: unknown): string;
