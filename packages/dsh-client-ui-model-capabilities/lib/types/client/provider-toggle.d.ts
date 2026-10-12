/**
 * Provider disable/enable orchestration over the remote settings wire.
 *
 * Disable = stash the user-layer profile in this plugin's own settings entry,
 * then unset `providers.<route>` in the pi-ai namespace (the official
 * Remove-provider seam): the route unregisters and the provider leaves the
 * model catalog that both the composer picker and the subagent selection read.
 * Enable restores the archived profile and clears the archive entry. Both
 * entries are revision-fenced; orderings keep the worst case a harmless
 * duplicate archive.
 * @module @fish-under-sea/dsh-client-ui-model-capabilities/client/provider-toggle
 */
import type { SettingsNamespaceFace } from './settings-face.ts';
/** What one toggle attempt ended in. */
export type ToggleOutcome = {
    kind: 'ok';
}
/** A namespace moved past its read revision; the caller reloads and retries. */
 | {
    kind: 'conflict';
    ns: string;
} | {
    kind: 'refused';
    message: string;
}
/** The pi-ai user layer holds no profile for the route (nothing to take down). */
 | {
    kind: 'no-profile';
}
/** Another layer (the composition base) holds the route, so the unset cannot take it down. */
 | {
    kind: 'base-profile';
}
/** The route already has a profile; restoring the archive would clobber it. */
 | {
    kind: 'route-exists';
} | {
    kind: 'no-stash';
}
/** A needed entry is not served on this host. */
 | {
    kind: 'unavailable';
}
/** The route is enabled again, but clearing the archive entry failed. */
 | {
    kind: 'partial';
    message: string;
};
/**
 * Take one provider down: archive its user-layer profile, then unset the
 * profile so the route unregisters.
 * @param face - the settings namespace face.
 * @param llmNs - the pi-ai namespace the provider is declared in.
 * @param route - provider route id.
 * @param displayName - display name for the archive listing, when known.
 */
export declare function disableProvider(face: SettingsNamespaceFace, llmNs: string, route: string, displayName: string | undefined): Promise<ToggleOutcome>;
/**
 * Bring one provider back: restore the archived profile verbatim, then clear
 * the archive entry. Refuses when the route has grown a new profile in the
 * meantime, so an enable can never clobber newer configuration.
 * @param face - the settings namespace face.
 * @param llmNs - the pi-ai namespace the provider is declared in.
 * @param route - provider route id.
 */
export declare function enableProvider(face: SettingsNamespaceFace, llmNs: string, route: string): Promise<ToggleOutcome>;
