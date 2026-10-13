import type { Context } from '@deepseek-ai/cordis';
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings';
import z from '@deepseek-ai/schemastery';
import { type UsageServiceOptions } from './host/usage-service.ts';
declare module '@deepseek-ai/cordis' {
    interface Events {
        /**
         * Volatile config values were committed into the running fiber without a
         * remount; dispatched to the owning fiber only. Spelled here because the
         * Loader package is not a dependency of this plugin, with the Loader's own
         * shape so the two declarations merge when a Host program carries both.
         * @param paths - changed config paths as key arrays; every value is committed before dispatch.
         * @mode emit
         */
        'loader/volatile-update'(paths: readonly (readonly string[])[]): void;
    }
}
export declare const name = "dsh-usage";
export declare const inject: string[];
/**
 * Family settings namespace this row serves. Since 0.1.7 the settings surface
 * addresses one form per profile entry id and the Host generates this row's
 * page from the Config schema below, so the namespace is only the alias the
 * family settings bridge (dsh-web-settings) resolves onto this row's entry id.
 */
export declare const USAGE_SETTINGS_NAMESPACE: SettingsNamespace;
/** The stable reference a `volatile()` config field resolves to; its owner updates it in place. */
interface ConfigRef<T> {
    /** @returns the value currently committed for the running instance. */
    get(): T | undefined;
}
/** One config field as the Host hands it over: a live reference, or a plain value (profile patches, tests). */
type ConfigField<T> = ConfigRef<T> | T | undefined;
/** The config the Host hands this activation — the runtime face of {@link Config}. */
export interface UsageConfigFields {
    enabled?: ConfigField<boolean>;
    /** Provider probe cycle in seconds; 30-3600. */
    pollIntervalSec?: ConfigField<number>;
    /** Ledger retention in local days. */
    retainDays?: ConfigField<number>;
}
/**
 * Plugin config schema. Under the 0.1.7 settings model this schema IS the
 * entry's settings page: the Host derives one form per profile entry from it
 * and serves it only when at least one field is `volatile()`. The marker is
 * also what admits a write and what keeps the edit on the live path — the
 * Loader commits the new value into the field's reference and announces
 * `loader/volatile-update` on this fiber instead of remounting the row, so the
 * probe cycle, its ledger and its route registrations survive a settings save.
 *
 * The schema is left to inference rather than annotated with
 * `z<UsageConfigFields>`: a volatile field's parsed output is a reference while
 * its accepted input stays the plain value, so the two sides no longer share
 * one shape and the annotation would reject the schema the Host must be given.
 */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    enabled: z<boolean, boolean, "volatile-defined">;
    pollIntervalSec: z<number, number, "volatile-defined">;
    retainDays: z<number, number, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    enabled: z<boolean, boolean, "volatile-defined">;
    pollIntervalSec: z<number, number, "volatile-defined">;
    retainDays: z<number, number, "volatile-defined">;
}>>, "plain">;
export interface ResolvedConfig extends UsageServiceOptions {
    enabled: boolean;
}
/**
 * Resolve the effective settings of one activation. Volatile references are
 * read here, so every re-arm observes the latest committed values rather than
 * whatever the row was activated with.
 * @param config - the config the Host passed to the activation.
 * @returns the resolved settings.
 */
export declare function resolveConfig(config?: UsageConfigFields): ResolvedConfig;
/**
 * Host body. The plugin's own Config schema above is the settings document the
 * 0.1.7 Host serves for this row; the effective config arrives here as the
 * `config` argument, and a settings save re-enters this body through the
 * volatile path rather than a row reload (see {@link Config}).
 * @param ctx - host root context.
 * @param config - the row's resolved configuration.
 */
export declare const apply: (ctx: Context, config?: UsageConfigFields) => void;
export {};
