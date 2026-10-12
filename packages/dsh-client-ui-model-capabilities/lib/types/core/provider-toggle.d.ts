/**
 * Provider disable/enable core: the disabled-profile archive and the path ops
 * a toggle performs.
 *
 * Disabling a provider uses the only sanctioned seam that takes it out of the
 * model catalog (which both the composer picker and the subagent selection
 * read): unset `llm-pi-ai.providers.<route>` — the same write the official
 * Remove-provider button performs. Because that deletes the profile, the
 * toggle first stashes it in this plugin's own settings entry (the `disabled`
 * field of its own Config) under `disabled.<route>`; enabling restores the
 * profile verbatim and clears the archive entry. Orderings are chosen so the
 * worst case is a harmless duplicate archive, never a lost profile.
 *
 * @module @fish-under-sea/dsh-client-ui-model-capabilities/core/provider-toggle
 */
import type { PathOp, SetPathOp } from './capabilities.ts';
/**
 * Profile entry ids this plugin's own row carries, in resolution order.
 *
 * The 0.1.7 settings surface addresses one form per ACTIVE PROFILE ENTRY ID
 * (`ctx.configForms.get(entryId)`, `settings.describe()` keyed by entry id)
 * and carries no package identity, so this plugin's own settings entry is the
 * profile row that mounts it — and that row id differs per install source: the
 * package's own cordis.patch.yml inserts `ui-model-capabilities`, while the
 * aggregate bundle namespaces every child row as `web-ui-*`
 * (scripts/aggregate.mjs) and mounts the same plugin under
 * `web-ui-model-capabilities`.
 */
export declare const CAPS_ENTRY_IDS: readonly string[];
/** One served settings form, as much of it as the archive resolution reads. */
export interface ServedSettingsForm {
    /** Profile entry id the Host serves this form under. */
    ns: string;
    /** Serialized form schema (`SettingsNamespaceView['schema']`). */
    schema?: unknown;
}
/**
 * Resolve the served settings form that is this plugin's own settings entry:
 * the row id this deployment mounts it under, or the entry whose form schema
 * is this plugin's archive schema (a profile that renamed the row).
 * @param namespaces - every form the Host served in one describe answer.
 * @returns the entry id and its view, or undefined when nothing served is this plugin's entry.
 */
export declare function resolveArchiveEntry<T extends ServedSettingsForm>(namespaces: readonly T[]): {
    entryId: string;
    view: T;
} | undefined;
/** One archived provider profile. */
export interface StashedProvider {
    /** The profile exactly as the user layer held it (open structure, verbatim). */
    profile: Record<string, unknown>;
    /** Display name at disable time, for the archive listing. */
    displayName?: string;
}
/**
 * Parse the archive from the namespace's resolved value: `disabled` keyed by
 * route id. Malformed entries are skipped (a stash this plugin did not write
 * must not break the listing).
 */
export declare function readDisabledStore(value: unknown): Record<string, StashedProvider>;
/** Whether one settings layer holds a profile for the route. */
export declare function hasProfileAt(section: unknown, route: string): boolean;
/**
 * Whether a layer other than the user section holds the route, so unsetting the
 * user profile would not take the provider down. The composition `base` layer
 * answers directly when the view carries it; a view without `base` falls back
 * to "the resolved value has it but the user layer does not".
 */
export declare function hasNonUserProfile(view: {
    user?: unknown;
    base?: unknown;
    value?: unknown;
}, route: string): boolean;
/** Archive one profile: `disabled.<route> = stash` in the plugin namespace. */
export declare function buildStashOp(route: string, stash: StashedProvider): SetPathOp;
/** Drop one archive entry: unset `disabled.<route>` in the plugin namespace. */
export declare function buildUnstashOp(route: string): PathOp;
/** Take the route down: unset `providers.<route>` in the pi-ai namespace. */
export declare function buildUnsetProviderOp(route: string): PathOp;
/** Bring the route back: restore the archived profile verbatim. */
export declare function buildRestoreProviderOp(route: string, profile: Record<string, unknown>): SetPathOp;
