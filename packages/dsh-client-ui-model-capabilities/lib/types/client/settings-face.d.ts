/**
 * The generated settings-namespace face the plugin's client surfaces need.
 * Typed locally (the generated `ClientRemote['settings']` resolves to `any`
 * fields under this repo's dependency graph, because skipLibCheck swallows
 * the settings-controller d.ts's own unresolved imports).
 * @module @fish-under-sea/dsh-client-ui-model-capabilities/client/settings-face
 */
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { SettingsDescribeValue, SettingsNamespaceView, SettingsPathOpView } from '@deepseek-ai/dsh-settings/types';
/** The settings namespace methods this plugin reads and writes through. */
export interface SettingsNamespaceFace {
    describe(): Promise<RemoteResult<SettingsDescribeValue>>;
    mutate(ns: string, ops: readonly SettingsPathOpView[], expectedRevision: number | undefined): Promise<RemoteResult<SettingsNamespaceView>>;
}
/**
 * Coalesce concurrent `describe` reads onto one wire call: every provider card
 * panel and the footer area reload from the same document update, and each one
 * describing the whole document separately would multiply the round trips by
 * the number of custom providers. Only in-flight reads are shared, so a later
 * call always observes the document as it stands then; `mutate` is passed
 * through untouched.
 * @param face - the generated remote settings face.
 * @returns a face with the same contract whose concurrent describes share one read.
 */
export declare function coalesceDescribe(face: SettingsNamespaceFace): SettingsNamespaceFace;
/**
 * Cross-surface refresh bus for the plugin's own client components: a toggle
 * from the provider card updates the disabled-providers footer and vice
 * versa; the host's `settings/document-updated` remote event drives it too.
 */
export interface RefreshBus {
    subscribe(callback: () => void): () => void;
    notify(): void;
}
