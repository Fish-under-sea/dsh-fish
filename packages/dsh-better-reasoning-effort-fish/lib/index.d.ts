/**
 * Host half of dsh-better-reasoning-effort.
 *
 * One job: settings auto-adaptation. Whenever the `llm-pi-ai` section gains a
 * hand-declared model that carries no `reasoningEfforts`, fill one in only when
 * the official model knowledge base has a verified entry. Unknown models stay
 * untouched; interactive Auto-adapt remains a browser-side, user-confirmed
 * path that may show protocol inference.
 *
 * @module dsh-better-reasoning-effort
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import { buildAutofillPatch } from './autofill.js';
/** Re-exported so the package entry keeps naming the patch builder. */
export { buildAutofillPatch };
/** Stable plugin id, matching the cordis.patch.yml row and the bundle id. */
export declare const name = "dsh-better-reasoning-effort-fish";
/** Hard dependencies: the loader waits for these before calling apply. */
export declare const inject: string[];
/**
 * Plugin configuration, supplied through the profile's cordis layer
 * (the row's `config:` block). Every tunable two deployments may want
 * to set differently lives here rather than as a code constant.
 */
export interface Config {
    /** Auto-fill undeclared models with a verified knowledge-base match (default true). */
    autofill?: boolean;
    /**
     * Whether the auto-fill above also fills the input-modality declaration
     * (default true). Effort auto-fill is governed by {@link autofill} alone.
     */
    modalityAutofill?: boolean;
    /** Upstream fetch timeout for the raw /models probe route, in milliseconds (default 15000). */
    probeTimeoutMs?: number;
    /**
     * Boot-fill retry backoff schedule in milliseconds; an empty list means
     * "try exactly once" (default [1000, 2000, 4000, 8000, 16000, 30000]).
     */
    bootRetryDelaysMs?: number[];
    /**
     * Rewrite effort-less calls to forced-thinking ladders into the ladder's
     * vendor default (default true). Only the request class that today becomes
     * `thinking: {type: disabled}` on a ladder that cannot switch thinking off
     * is rewritten (issue #2); everything else passes through byte-identical.
     */
    defaultGuard?: boolean;
    /**
     * Take over `user-agent` at the fetch layer for every route whose `headers`
     * declare one (default true). The official adapter drops a profile
     * `user-agent` in favour of the harness attribution, so a gateway that
     * fingerprints the client identity never sees the configured value; this
     * overlay is the only seam that can send it (issue #12). Inert unless a route
     * actually declares a `user-agent`; turn it off to leave the wire to another
     * plugin that rewrites the same surface.
     */
    uaOverride?: boolean;
}
/** Schemastery schema: Cordis validates the row config and fills defaults before apply(). */
export declare const Config: Schema<Config>;
/**
 * Compose the raw-models probe request's headers, mirroring the discipline of
 * the harness's own model discovery: the provider
 * profile's configured request headers form the base (deployment-owned
 * credentials like `x-api-key` ride along), `accept` is always JSON, and a
 * resolved credential's Bearer overwrites a profile `authorization` — which
 * survives only when no credential resolves (a route may authenticate through
 * its configured headers alone). Anthropic Messages answers through
 * `x-api-key` plus a fixed `anthropic-version`, and its Bearer arm is never
 * used (a profile `authorization` survives untouched there, exactly as the
 * official discovery leaves it). Entries Fetch would refuse are dropped
 * rather than failing the probe. Harness attribution headers are deliberately
 * not sent — this is a same-origin diagnostic, not a harness request.
 * @param profileHeaders - the profile's raw `headers` dict (simply absent
 *   on older documents).
 * @param apiKey - the resolved credential, when one resolved.
 * @param api - the profile's wire protocol.
 */
export declare function composeProbeHeaders(profileHeaders: unknown, apiKey: string | undefined, api: string): Record<string, string>;
/**
 * What the default guard has done in this process, for the status route.
 *
 * The wrap is process-wide and leaves no trace in the settings document, so
 * "the feature is enabled" and "the feature ever fires" would otherwise be
 * indistinguishable -- which is what made this takeover hard to keep honest.
 */
export interface GuardReport {
    /** Whether the wrap is enabled by configuration. */
    enabled: boolean;
    /** Whether the llm dispatch entries are currently wrapped. */
    installed: boolean;
    /** Effort-less calls naming a route and a model that the guard examined. */
    inspected: number;
    /** Calls it rewrote with the ladder's vendor default. */
    injected: number;
    /** The most recent rewrite, so a reviewer can see that it fires at all. */
    lastInjection?: {
        provider: string;
        model: string;
        level: string;
    };
}
/**
 * Apply the plugin: autofill undeclared models on boot and after every commit
 * that touches the pi-ai namespace.
 * @param ctx - host context.
 */
export declare function apply(ctx: Context, config?: Config): void;
