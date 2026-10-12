/**
 * Family settings form bound to the profile entry id a Host actually serves.
 *
 * Under the 0.1.7 settings model a form is addressed by PROFILE ENTRY ID, while
 * a family card knows only its own settings namespace. The family binder
 * (`ctx.get('webUiSettings')`, published by dsh-web-settings) resolves one onto
 * the other and is the preferred transport; this module is the fallback for a
 * page that serves no binder — the group plugin is not installed, or its client
 * half has not applied yet (the aggregate mounts its children in order, and a
 * child still waiting on its own injects publishes nothing).
 *
 * The shared describe mirror is the only local evidence of which row id this
 * profile serves, but it answers asynchronously: at plugin activation it usually
 * holds nothing yet. A one-shot guess therefore cannot be right for every
 * deployment, and the form is bound once per session:
 *
 * - binding the bare namespace made every save answer `No configurable plugin
 *   entry "<namespace>"` on an aggregate install (the namespace is not an entry
 *   id there), which the card reported as "the deployment did not accept these
 *   values";
 * - binding the aggregate row id would break a standalone install, whose row id
 *   is the namespace or the package's own `ui-*` row.
 *
 * So the fallback starts on the most likely row and REBINDS the moment the
 * mirror names one of this package's rows. Until the mirror answers, the form
 * reports the binding it holds (usually `loading`), which the card renders as an
 * unavailable form rather than a doomed one.
 */
import type { ConfigForm, ConfigForms } from '@deepseek-ai/dsh-client-ui-settings/client';
/** Options of {@link createServedEntryForm}. */
export interface ServedEntryFormOptions<T> {
    /** The shared configuration forms service (`ctx.configForms`). */
    forms: ConfigForms;
    /**
     * Profile entry ids this package's rows carry, most likely first: the
     * aggregate's generated row, the package's own standalone row, then the bare
     * namespace. The first is the fallback while the mirror has no answer; the
     * last is the answer when the mirror serves none of them.
     */
    entryIds: readonly string[];
}
/**
 * Create a settings form bound to the profile entry id this Host serves, and
 * rebound whenever the shared describe mirror names a different one of this
 * package's rows.
 * @param options - the shared forms service and this package's candidate row ids.
 * @returns a form delegating to the currently resolved entry's own form.
 */
export declare function createServedEntryForm<T>(options: ServedEntryFormOptions<T>): ConfigForm<T>;
