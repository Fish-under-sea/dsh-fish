/**
 * The agent-preset roster the execution-target pickers read: one read of the
 * generated api-remotes face, and its normalization into the option rows the
 * board controller and the settings card's new-card-defaults topic both
 * consume.
 *
 * The roster is a runtime fact of the deployment, not ledger state. The
 * namespace mounts with the official api-remotes assembly, so the read itself
 * is wired through a scoped inject at the call site (see src/client/index.ts);
 * this module owns only the shape both consumers agree on, so neither has to
 * know how the wire face answers.
 */
import type { ClientRemote } from '@deepseek-ai/dsh-api-remotes/client';
import type { ExecutionPresetOption } from '../../core/controller.ts';
/** The generated Remote namespace the mode pickers read their roster from. */
export type PresetRemote = ClientRemote['agentPresets'];
/** One agent-preset row the wire face answers with. */
export interface PresetRosterRow {
    id: string;
    name?: string;
    description?: string;
    /** Why this preset cannot compose a session; absent when it can. */
    broken?: string;
    isDefault: boolean;
}
/**
 * Read the agent-preset roster of one deployment. The caller passes the
 * namespace resolved inside its scoped inject, so a host that serves no such
 * namespace never reaches here; a host that serves it answers `ok: false`
 * instead, which leaves the caller's options untouched.
 * @param remote - the `remote.agentPresets` namespace.
 * @returns the roster, or a failed read the caller ignores.
 */
export declare function readPresetRoster(remote: PresetRemote): Promise<{
    ok: boolean;
    presets: readonly PresetRosterRow[];
}>;
/**
 * Normalize one roster into the picker rows the UI consumes. A preset that
 * cannot compose a session keeps its `broken` reason: the pickers show it and
 * disable it, so a missing preset never looks like a missing roster.
 * @param presets - the roster rows.
 * @returns the picker options.
 */
export declare function presetOptionsFromRoster(presets: readonly PresetRosterRow[]): ExecutionPresetOption[];
