/**
 * Shape guards and settings-dict readers shared by the host and browser
 * halves. Pure data logic only: esbuild inlines this module into both
 * bundles, so it must never import a harness package or touch DOM/node APIs.
 *
 * @module dsh-better-reasoning-effort/shared
 */
import type { RouteFacts } from './knowledge.js';
/** Whether a value is a plain-ish object (not null, not an array). */
export declare const isRecord: (value: unknown) => value is Record<string, unknown>;
/**
 * Whether a settings refusal reads like "this kernel does not know the newer
 * compat keys". The host autofill and the browser write path each downgrade
 * once on this signal, so they must answer identically.
 */
export declare function looksLikeCompatRefusal(message: string): boolean;
/**
 * Whether a route profile's `models` value actually declares rows.
 *
 * An empty array is NOT a declaration. Schemastery materializes an absent,
 * non-required array field with the array schema's `meta.default`, which is
 * always `[]`, so every schema-resolved profile carries `models: []` for a
 * route that declares none -- and the settings namespace's resolved `value`
 * and its composition `base` are both schema-resolved. Testing merely
 * `Array.isArray(models)` therefore reports "declared" for a route that
 * declares only `modelOverrides`, which silently hides every catalog row.
 */
export declare function declaresModels(value: unknown): value is unknown[];
/**
 * Whether one route's profile stores its models through the official
 * `modelOverrides` map rather than an explicit `models` list.
 *
 * A route that declares no `models` rows serves the installed catalog, and
 * everything it customizes lives in the override dict -- which starts empty, so
 * the document holds nothing for the models it serves. The row still exists on
 * the official page, because the catalog serves it: absence from the override
 * dict is not absence of the model. Callers use this to tell "the document has
 * no entry for this row yet" (writable, as a new override) apart from "this row
 * was never declared" (only ever true of an explicit `models` list).
 */
export declare function usesModelOverrides(providers: unknown, route: string): boolean;
/** The models array of one route in a providers dict, as records. */
export declare function modelsOf(providers: unknown, route: string): Record<string, unknown>[];
/** One provider profile's route facts, as suggestion inference reads them. */
export declare function routeFactsOf(providers: unknown, route: string): RouteFacts;
