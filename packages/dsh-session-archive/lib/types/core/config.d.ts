/**
 * Configuration shape and validation for dsh-session-archive, shared by the
 * host schema and the client settings form. Pure logic.
 * @module @fish-under-sea/dsh-session-archive/core/config
 */
export interface SessionArchiveConfig {
    enabled?: boolean;
    /** Auto-archive sessions inactive for more than this many days. Default off. */
    autoArchiveEnabled?: boolean;
    /** Inactivity threshold in days for auto-archive (1-3650). */
    autoArchiveDays?: number;
    /** Physically delete archived sessions older than this many days after archive time. Default off. */
    autoDeleteEnabled?: boolean;
    /** Archive retention in days for auto-delete (1-3650). */
    autoDeleteDays?: number;
    /** Scheduler cadence in minutes (15-1440). */
    checkIntervalMin?: number;
}
/**
 * One config field as the 0.1.7 Host delivers it to the running plugin: every
 * field the schema declares volatile arrives as a stable reference whose
 * `get()` reads the value committed for this instance (a settings write updates
 * the reference in place, without remounting the row).
 */
export interface ConfigFieldRef<T> {
    /** @returns the value currently committed for the running instance. */
    get(): T | undefined;
}
/** One activation field: a volatile reference, or a plain value (profile patches, tests). */
export type ConfigField<T> = T | ConfigFieldRef<T> | undefined;
/**
 * The settings the Host hands this plugin's activation (its own Config schema,
 * resolved over the composition base and the profile's user layer).
 */
export interface SessionArchiveConfigFields {
    enabled?: ConfigField<boolean>;
    autoArchiveEnabled?: ConfigField<boolean>;
    autoArchiveDays?: ConfigField<number>;
    autoDeleteEnabled?: ConfigField<boolean>;
    autoDeleteDays?: ConfigField<number>;
    checkIntervalMin?: ConfigField<number>;
}
/**
 * Read one activation field's current value. A volatile reference is read at
 * call time, so the caller always sees the latest committed value.
 */
export declare function readConfigField<T>(field: ConfigField<T>): T | undefined;
/**
 * Read the effective settings of one activation. The 0.1.7 model keeps no
 * separate settings document: the plugin's own Config is what the Host serves
 * and what the row is activated with, so this is the only settings source.
 * @param config - the config the Host passed to the activation.
 * @returns the raw field values, defaults left to {@link resolveAutoConfig}.
 */
export declare function readArchiveConfig(config?: SessionArchiveConfigFields): SessionArchiveConfig;
export interface ResolvedAutoConfig {
    enabled: boolean;
    autoArchiveEnabled: boolean;
    autoArchiveDays: number;
    autoDeleteEnabled: boolean;
    autoDeleteDays: number;
    checkIntervalMin: number;
}
export declare const AUTO_ARCHIVE_DAYS_MIN = 1;
export declare const AUTO_ARCHIVE_DAYS_MAX = 3650;
export declare const AUTO_DELETE_DAYS_MIN = 1;
export declare const AUTO_DELETE_DAYS_MAX = 3650;
export declare const CHECK_INTERVAL_MIN_MIN = 15;
export declare const CHECK_INTERVAL_MIN_MAX = 1440;
export declare const DEFAULT_AUTO_CONFIG: ResolvedAutoConfig;
/** Validate one day-threshold field; returns the rounded value or undefined when invalid. */
export declare function validateDays(value: unknown, min: number, max: number): number | undefined;
/**
 * Coerce a raw config into resolved values. Invalid or out-of-range fields
 * fall back to defaults — the settings UI validates before saving, and this
 * guards profile-patch hand-written values.
 */
export declare function resolveAutoConfig(config?: SessionArchiveConfig): ResolvedAutoConfig;
