/**
 * Settings reader of the dsh-ssh browser half.
 *
 * The plugin's browser half owns one preference: the xterm `fontFamily` the
 * panel applies to its terminals. Under the 0.1.7 settings model that field
 * belongs to the plugin's own profile entry (its Cordis Config schema), and
 * the browser surface addresses settings as one form per profile entry id — so
 * the entry has to be resolved before its section can be read:
 *
 * - the family binder (`ctx.get('webUiSettings')`, published while
 *   dsh-web-settings is loaded) resolves the dsh-ssh namespace to its entry id
 *   through the Host bridge and hands back the native shared form;
 * - without that group the shared configuration forms serve the form directly,
 *   and the entry is recognised by the one field this plugin's own schema
 *   declares: the entry whose resolved section carries `terminalFontFamily`.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client';
/** Domain-owned description of one settings namespace a family surface binds. */
export interface ConfigFormSpec<T> {
    /** Settings namespace the surface edits. */
    namespace: string;
    /**
     * Narrow one wire section; undefined keeps the section the Host resolved.
     * The shared form already validates against the namespace's serialized
     * schema, so a decoder exists only to narrow beyond it.
     */
    decode?: (section: unknown) => T | undefined;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        /**
         * Optional family settings binder provided by dsh-web-settings; absent when
         * that group plugin is not installed, so callers fall back to the shared
         * configuration forms service (`ctx.configForms`).
         */
        webUiSettings?: {
            bind<S>(spec: ConfigFormSpec<S>): ConfigForm<S>;
        };
    }
}
/** The read face this plugin needs from its own settings entry. */
export interface SettingsReader<T> {
    /** @returns the current snapshot (stable reference until the next change). */
    getSnapshot(): ConfigFormSnapshot<T>;
    /** Observe snapshot replacements. */
    subscribe(listener: () => void): () => void;
}
/** A reader plus the release of every subscription it installed. */
export interface SettingsBinding<T> extends SettingsReader<T> {
    /** Release the reader's subscriptions; later calls are no-ops. */
    dispose(): void;
}
/**
 * Bind this plugin's settings reader.
 * @param ctx - client context carrying the family binder and/or the shared forms service.
 * @param namespace - the family settings namespace this plugin owns.
 * @param field - the field this plugin's own schema declares, used to recognise its entry when the family binder is absent.
 * @returns the reader and the release of its subscriptions.
 */
export declare function bindSettingsReader<T>(ctx: ClientContext, namespace: string, field: string): SettingsBinding<T>;
