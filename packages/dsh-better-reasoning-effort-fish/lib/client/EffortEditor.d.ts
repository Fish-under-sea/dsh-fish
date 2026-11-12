/**
 * The thinking-effort + input-modality editor injected into the official
 * Models page's model rows. Rendered with ReactDOM.createRoot into a DOM
 * container the injector creates, it needs no harness services of its own:
 * everything arrives through a plain props face, so it stays testable in
 * isolation. The draft/intent rules live in the client/effort module.
 *
 * Suggestion feedback is ZONED: provenance + confidence form their own line;
 * capacity references render as a separate read-only block explicitly marked
 * "never auto-filled" -- the official capacity inputs above stay untouched.
 * The apply/reset actions sit at the very bottom and own every section.
 *
 * @module dsh-better-reasoning-effort/EffortEditor
 */
import type { ReactNode } from 'react';
import type { CompatSuggestion, InputModalities, ReasoningEfforts } from '../knowledge.js';
import { type DraftLevels } from './effort.js';
import type { EffortEditorApi } from './types.js';
/** One model row's data the editor needs. */
export interface EffortModel {
    /** Model id (the settings key). */
    id: string;
    /** Display name, when one is set. */
    name?: string;
    /** The model's current reasoningEfforts declaration. */
    efforts?: false | ReasoningEfforts;
}
/** Props of {@link EffortEditor}. */
export interface EffortEditorProps {
    /** Route key. */
    route: string;
    /**
     * Route display name. Part of the mount contract but never rendered here:
     * this editor lives inside ONE model row, whose provider card already
     * carries the name, so the component does not even destructure it. The
     * injector keeps it in the prop set and its sameProps diff compares it, which
     * is what catches a provider rename under an already-mounted editor.
     */
    routeDisplayName: string;
    /** Route wire protocol, when configured. */
    routeApi?: string;
    /** Route endpoint, when configured. */
    routeBaseURL?: string;
    /** Model id. */
    modelId: string;
    /** Model display name, when one is set. */
    modelName?: string;
    /** The model's current reasoningEfforts declaration. */
    efforts?: false | ReasoningEfforts;
    /** The model's current input-modality declaration. */
    input?: InputModalities;
    /** The model's stored compat block (passthrough; suggestions merge over it). */
    compat?: CompatSuggestion;
    /** The model's stored per-model default-effort pick, when one is set. */
    defaultEffort?: string;
    /** Model row index (for aria labels). */
    index: number;
    /**
     * The model row is not saved yet (a create card's draft route, or a new
     * model row on a saved route). Apply then stages the declaration instead
     * of writing settings; the injector applies staged declarations
     * automatically once the row is saved.
     */
    staged?: boolean;
    /**
     * Whether the official Models page owns input types for this row (the
     * 0.1.6-alpha.2 `ModelInputTypes` control was sniffed in the disclosure).
     * True hides the modality section: the official editor is the single
     * surface, so showing a second one would be duplicate UI. Older kernels
     * have no such control and keep the section.
     */
    officialInputTypes?: boolean;
    /**
     * Push a suggested modality set into the official Input-types control. The
     * injector owns the DOM call; the editor only decides WHEN (an Auto-adapt
     * that actually carried modalities, on a row the official editor owns).
     */
    syncOfficialInput?: (input: InputModalities) => void;
    /**
     * Whether the official Models page owns reasoning levels for this row (the
     * 0.2.1-alpha.4 `ModelReasoningEfforts` block was sniffed in the disclosure).
     * True hides the ladder controls and keeps `reasoningEfforts` out of every
     * write: the official editor is the single ladder surface, while this editor
     * still sets the default level, endpoint compatibility and Auto-adapt's
     * non-ladder parts.
     */
    officialReasoning?: boolean;
    /** The write seam (settings.mutate plus the suggestion engine). */
    api: EffortEditorApi;
    /** Read-only (settings document not writable). */
    readOnly: boolean;
    /** Localized copy. */
    t: (key: string, params?: Record<string, string | number>) => string;
}
/**
 * The compat fields this editor can SET, per protocol — which is also the set
 * it may clear. A key from neither list survives an apply untouched: a
 * hand-tuned field the UI never showed is not this editor's to drop. Clearing
 * a picker means unset, not "keep whatever was chosen last".
 */
export declare const OWNED_COMPAT_KEYS: Readonly<Record<string, readonly string[]>>;
/** The compat fields clearable on one protocol (empty = this edit owns none). */
export declare function ownedCompatKeys(routeApi: string | undefined): readonly string[];
/** The owned compat fields the draft actually left EMPTY. */
export declare function clearedCompatKeys(routeApi: string | undefined, draft: CompatSuggestion | undefined): readonly string[];
/**
 * The `clearCompatKeys` part of a commit, derived from the draft.
 *
 * A DEFINED draft always reports (an empty array is meaningful: every owned
 * field it shows is set). An EMPTY draft must still clear the fields the
 * protocol OWNS -- dropping the last owned pick is a user decision to unset --
 * but only when there is something to clear: an unrelated route keeps the
 * shape it always had (no `clearCompatKeys` at all).
 * @param routeApi - the route's wire protocol.
 * @param writeCompat - the compat bytes this commit writes, if any.
 * @returns the clear part to spread into the commit payload.
 */
export declare function compatClearIntent(routeApi: string | undefined, writeCompat: CompatSuggestion | undefined): {
    clearCompatKeys?: readonly string[];
};
/**
 * Render one model's thinking-effort + input-modality editor: the level
 * checkboxes, the modality toggle, the auto-adapt action, and the
 * apply/reset actions that own both sections.
 */
export declare function EffortEditor({ route, routeApi, routeBaseURL, modelId, modelName, efforts: initialEfforts, input: initialInput, compat: initialCompat, defaultEffort: initialDefaultEffort, index, staged, officialInputTypes, officialReasoning, syncOfficialInput, api, readOnly, t }: EffortEditorProps): ReactNode;
export type { DraftLevels };
