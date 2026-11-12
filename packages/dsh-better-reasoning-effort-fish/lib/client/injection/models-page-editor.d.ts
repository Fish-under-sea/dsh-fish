/**
 * The DOM bypass injector: the piece that makes reasoning effort editable
 * *inside* the official Models page's model rows.
 *
 * The official Models-page slot contract's two sanctioned seats are both
 * coarser than a model row: the keyed `settings.models.provider-card`
 * renders per provider card and `settings.models.footer`
 * renders after the rows — neither reaches a single model row's editor
 * internals, so this plugin mounts its editor as a DOM contribution next to
 * the official per-model capacity disclosure. The anchor is the official
 * disclosure chevron button, found by aria-label in both locales (the
 * `modelAdvanced` dictionary value: "Capacities"/容量 through 0.1.6-alpha.1,
 * "Model options"/模型选项 from 0.1.6-alpha.2); the editor is inserted into the
 * same disclosure container that holds the official context-window / max
 * tokens fields.
 *
 * Because this walks the official page's rendered DOM (class names and
 * structure that the harness can change), the injector is defensive by
 * construction:
 *   - it re-scans on every DOM mutation (a routed page, an open editor, an
 *     applied form all re-render), and every scan reconciles idempotently;
 *   - a model row that carries no disclosure yet is left alone and picked up
 *     on the next mutation;
 *   - if the official structure it depends on ever stops appearing, it simply
 *     stops injecting — the settings page remains untouched.
 *
 * @module dsh-better-reasoning-effort/client/injection/models-page-editor
 */
import { type CompatSuggestion, type InputModalities, type ReasoningEfforts } from '../../knowledge.js';
import type { EffortEditorApi, EffortWriteIntent, HeldWrite, RemoteApi, SettingsJoin } from '../types.js';
export type { SettingsJoin };
/**
 * Localized aria-labels of the official settings controls this injector
 * anchors to, in the language the host is currently rendering.
 *
 * The host renders these labels from its own `settings.models` dictionary
 * (`ui-settings-models`), so the plugin must read them through the same
 * channel instead of pinning the two languages it knows about: a host
 * language pack that adds, say, Japanese would otherwise relabel every
 * control and leave the injector unable to find a single model row. Each
 * field carries the active language first and English last — English is the
 * host's own fallback floor, so it doubles as ours.
 *
 * Every field is a LIST because the official labels are numbered per row
 * ("Model ID 1", "モデル ID 2", …) and are matched by prefix.
 */
export interface HostLabels {
    /** The per-row disclosure button ("Model options", "模型选项", "Capacities", "容量", …). */
    capacity: readonly string[];
    /** The model-id input. */
    modelId: readonly string[];
    /** The per-row display-name input. */
    modelName: readonly string[];
    /** The create card's route-id input. */
    routeId: readonly string[];
    /** The create card's endpoint input. */
    baseUrl: readonly string[];
    /** The create card's protocol select. */
    apiProtocol: readonly string[];
    /**
     * The editing card's commit button. C2 drives the plugin's landing write off
     * the official Save, so the button is resolved when the action row's own
     * structure cannot be read (the buttons ARE the last child pair of
     * `[class*="editorActions"]`; the copy is the fallback).
     */
    apply: readonly string[];
    /** The editing card's dismiss button (the commit's left-hand sibling). */
    cancel: readonly string[];
}
/** The join the injector renders from. */
export interface InjectorDeps {
    /**
     * The settings Remote face for THIS scan/write. The kernel mounts
     * `remote.settings` as an injectable service, so the plugin's own top-level
     * `inject` declaration guarantees it before apply runs — no runtime seat
     * probing remains.
     */
    api: RemoteApi;
    /** Read the pi-ai namespace plus writability from the settings join. */
    describeNamespace(): Promise<SettingsJoin>;
    /** Localized copy. */
    t: (key: string, params?: Record<string, string | number>) => string;
    /**
     * The official controls' aria-labels in the ACTIVE language. A thunk, not a
     * value: the host resolves labels through the same fallback chain it renders
     * from, so re-reading per scan is what keeps a language switch (and a late
     * language pack) in step with the page it has to find controls on.
     */
    labels(): HostLabels;
    /** Mount one editor into a container (React); render() updates its props in place. */
    mount(container: HTMLElement, props: EditorMountProps): MountedEditor;
    /**
     * Runs after an idle pass landed everything the session held back. The
     * browser half hangs its autofill complement here: "the user stopped
     * editing" is the only moment this side may safely write the document.
     */
    onIdle?(): void;
    /**
     * Arm a timed retry after a failed idle pass. The backoff clock only helps
     * if something wakes the injector when it expires; a settled page has no DOM
     * mutation to schedule the next scan. Optional so tests drive passes by hand.
     */
    onBackoff?(delayMs: number): void;
}
/** One mounted editor: unmount disposes the React root; render swaps props in place. */
export interface MountedEditor {
    unmount(): void;
    render(props: EditorMountProps): void;
}
/** Props handed to the editor mount for one model row. */
export interface EditorMountProps {
    /** The route being edited. */
    route: string;
    /** Route display name (shown in the editor header). */
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
    /** The model's stored compat block (passthrough; the editor merges suggestions over it). */
    compat?: CompatSuggestion;
    /** The model's stored per-model default-effort pick, when one is set. */
    defaultEffort?: string;
    /** Row ordinal among the models found in this scan (for aria labels). */
    index: number;
    /** True while the row is unsaved (a create card's draft route, or a new
     * model row on a saved route): Apply stages the declaration instead of
     * writing, and the injector lands it once the row is saved. */
    staged?: boolean;
    /**
     * Whether the official Models page owns input types for this row: 0.1.6-alpha.2
     * renders its own ModelInputTypes control inside the disclosure. When true,
     * the editor hides its modality section — a CAPABILITY sniffed from the row
     * DOM, never a kernel version.
     */
    officialInputTypes?: boolean;
    /**
     * Whether the official Models page owns reasoning levels for this row:
     * 0.2.1-alpha.4 renders its own Reasoning levels editor inside the
     * disclosure. When true, the editor hides its ladder controls and never
     * writes `reasoningEfforts`; the default pick, endpoint compatibility and
     * Auto-adapt's non-ladder parts stay — again a CAPABILITY sniffed from the
     * row DOM, never a kernel version.
     */
    officialReasoning?: boolean;
    /**
     * Hand a suggested modality set to the OFFICIAL Input-types control when it
     * owns them: the pending write only reaches the settings document on Save,
     * so Auto-adapt would otherwise leave the click with nothing to show.
     */
    syncOfficialInput?: (input: readonly string[]) => void;
    api: EffortEditorApi;
    readOnly: boolean;
    t: (key: string, params?: Record<string, string | number>) => string;
}
/** Mutable scan state kept across reconcile invocations. */
export interface ScanState {
    /** Currently mounted editors, keyed by their container element. */
    mounted: Map<HTMLElement, {
        editor: MountedEditor;
        props: EditorMountProps;
    }>;
    /** The last describe promise, folded so scans never stack reads. */
    describePromise: Promise<SettingsJoin> | undefined;
    /**
     * Declarations staged against routes that do not exist in the settings
     * document yet (the create card's typed route id), keyed route → model id.
     * Flushed automatically once a route appears. Mirrored into `sessionStorage`
     * so a same-document fiber cycle (HMR, disable-then-enable) keeps the user's
     * mid-edit staging; a real reload discards it (see {@link restoreLedger}).
     */
    pending: Map<string, Map<string, StagedDeclaration>>;
    /**
     * Staged models that looked ghosted on the last scan (their route is saved,
     * but no matching row exists on the page anymore). Withdrawn once they miss
     * TWO consecutive scans, so one transient re-render gap cannot drop real
     * mid-edit staging. Mirrors {@link pending}'s key shape.
     */
    missedScans: Map<string, Set<string>>;
    /**
     * Writes an ON-SCREEN editor asked for while the official card held the
     * document, keyed route → model id. Kept verbatim (this is the user's own
     * declaration, so no suggestion arbitration applies) and replayed the
     * moment the card is gone. Persisted beside its commit evidence, so a
     * same-document fiber cycle still lands a write the official Save
     * authorized, while a reload or a dismissed card drops it (see
     * {@link restoreLedger} / {@link forgetRoute}).
     */
    queued: Map<string, Map<string, HeldWrite>>;
    /**
     * Whether an official editing card was on the page at the last reconcile.
     * `undefined` until the first scan. The `!== false` test is what makes the
     * idle pass run exactly once per editing session -- and once for a page
     * that loads straight into the models section without ever editing.
     */
    editing: boolean | undefined;
    /**
     * Whether an idle pass is in flight. One pass at a time: two overlapping
     * passes would describe the same revision and then fight over it, turning a
     * clean replay into a self-inflicted `settings/conflict`.
     */
    flushing: boolean;
    /** Consecutive failed idle passes; the backoff exponent. Reset on success. */
    flushFailures: number;
    /** Earliest `Date.now()` at which the next retry may run (0 = any time). */
    nextFlushAt: number;
    /**
     * Routes whose OFFICIAL card committed in this session (the user pressed its
     * commit button). The held ledgers land per route: only the routes the user
     * actually saved are written, because the official card's Save is now what
     * commits this plugin's edits too (issue #7 / C2). An intent the user
     * dismissed without saving is dropped, exactly like the card's own fields.
     */
    committing: Set<string>;
    /**
     * Whether the official action row has failed to yield usable buttons for
     * every card seen so far. When it has, the landing decision degrades to
     * "the card went away, so write it" -- writing too much is recoverable,
     * silently losing the user's declaration is not.
     */
    signalsUnavailable: boolean;
    /** Commit buttons already wired, so a re-scan never double-registers. */
    submitWired: WeakSet<Element>;
    /** Cancel buttons already wired. */
    cancelWired: WeakSet<Element>;
}
/**
 * One staged declaration: the level set plus the suggestion's compat block and
 * modalities. A 'keep' effort travels untouched to the flush write. The
 * per-model default-effort pick (issue #4) rides along: a string to write,
 * null to clear, absent to touch nothing.
 *
 * Design note: staging cannot express a deliberate UNSET. An all-clear draft
 * stages `keep`/no-input, whose flush resolves to null and withdraws the
 * whole staging -- host autofill then fills its suggestion back in. To record
 * "declare nothing" durably, save the row first and apply an all-clear write
 * through the saved-row seam (the durable unset marker).
 */
export interface StagedDeclaration {
    efforts: Exclude<EffortWriteIntent, undefined>;
    compat?: CompatSuggestion;
    input?: InputModalities;
    defaultEffort?: string | null;
}
/**
 * Land whatever the session held back, best effort, when the fiber is about to
 * go away (plugin disable / HMR). The ledgers STAY in `sessionStorage` (with
 * their commit evidence), so the next fiber in the same document picks the work
 * up; a flush the runtime cuts short is simply retried by that fiber.
 * @param state - the scan state whose ledgers to drain.
 * @param deps - the injection dependencies.
 */
export declare function flushOnTeardown(state: ScanState, deps: InjectorDeps): void;
/**
 * The page is going away: land the committed intents best effort, then CLEAR
 * the ledger. Unlike a fiber cycle, a reload discards the official card's own
 * draft, so the plugin's must go too -- anything the cut-short flush could not
 * land must not be resurrected by the next document. (The window sentinel
 * covers the case pagehide never fires: crash / plugin already disabled.)
 * @param state - the scan state whose ledgers to drain.
 * @param deps - the injection dependencies.
 */
export declare function flushOnUnload(state: ScanState, deps: InjectorDeps): void;
export declare function createScanState(): ScanState;
/**
 * Record (or, for `undefined`, withdraw) one staged declaration. A route with
 * no staged models left leaves the store entirely.
 */
export declare function stageEffortsInto(state: ScanState, route: string, modelId: string, efforts: EffortWriteIntent, compat?: CompatSuggestion, 
/**
 * The modality part. `null` is a deliberate unset (the editor's "clear
 * declaration" on an unsaved route) and stores as such: the staged flush
 * reads it back verbatim, exactly like the saved-row seam does.
 */
input?: InputModalities | null, defaultEffort?: string | null): void;
/**
 * Record (or replace) the write an on-screen editor asked for while the
 * official card held the document. The latest intent for a row wins: the user
 * may apply twice before closing the card.
 * @param state - mutable scan state.
 * @param route - the route being edited.
 * @param modelId - the model id being edited.
 * @param write - the full intent, kept verbatim for the replay.
 */
export declare function queueWriteInto(state: ScanState, route: string, modelId: string, write: HeldWrite): void;
/**
 * Withdraw one row's staged intent (the create card's erase-that-row flow, and
 * the editor's Reset on a route the document does not hold yet). Idempotent,
 * and it clears the route entry once its last model is gone.
 * @param state - mutable scan state.
 * @param route - the route the staging was made against.
 * @param modelId - the model whose intent to drop.
 */
export declare function withdrawStaged(state: ScanState, route: string, modelId: string): void;
/**
 * Withdraw one row's held intent (the editor's own Reset, or any later
 * "discard this edit"). Idempotent, and it clears the route entry once its
 * last model is gone.
 * @param state - mutable scan state.
 * @param route - the route the editor was editing.
 * @param modelId - the model whose intent to drop.
 */
export declare function withdrawHeldWrite(state: ScanState, route: string, modelId: string): void;
/**
 * Withdraw a row's intent wherever it landed.
 *
 * The editor's Reset is the caller and it does not know which ledger its own
 * `commit` fed — the create card stages, a saved row queues, and the same row
 * can move between the two as the user edits the route id. Discarding only one
 * of them would leave the Reset cosmetic on the other: the official Save would
 * still write edits the user explicitly threw away.
 * @param state - mutable scan state.
 * @param route - the route the editor was editing.
 * @param modelId - the model whose intent to drop.
 */
export declare function withdrawIntent(state: ScanState, route: string, modelId: string): void;
/**
 * Drop every intent one route holds, right now: the official card's cancel.
 *
 * The card's own fields die with the dismissal, so the plugin's must too -- and
 * they must die at the CLICK, not on some later scan. A deferred "discarded"
 * marker would outlive the card that set it (a dismiss carrying no plugin edit
 * leaves nothing for a later pass to drain), and the next card for that same
 * route would then be read as already-dismissed: its Save would never be
 * wired, and the user's fresh edit would be dropped silently. Clearing the
 * ledgers here leaves no state at all to misinterpret -- including the staged
 * declaration a dismissed CREATE card was holding for a route that does not
 * exist yet, which would otherwise land the moment that route appeared.
 *
 * Safe by construction: the official page keeps ONE editing card at a time
 * (create and edit mutually exclusive), so the route this resolves is the only
 * card that could own these entries.
 * @param state - mutable scan state.
 * @param route - the route whose official card was dismissed.
 */
export declare function forgetRoute(state: ScanState, route: string): void;
/**
 * The write intents one staged declaration survives against the SAVED row,
 * decided PER PART: staging never overwrites what the document already says,
 * but a part the document took over must not silence its sibling. Returns
 * null when nothing is left to write (the model vanished from the card, or
 * every part was taken over / is a keep) -- the caller withdraws the staging.
 */
export interface EffectiveStagedIntents {
    efforts: EffortWriteIntent;
    compat?: CompatSuggestion;
    input?: InputModalities;
    /** The staged default-effort pick, when the staging carried one. */
    defaultEffort?: string | null;
    /**
     * Compat fields the edit OWNS and left empty, so "unset" can mean unset
     * instead of keeping the last choice forever. Computed by the editor's own
     * `clearedCompatKeys` against the route's protocol, never against the whole
     * stored block: a hand-tuned field the editor never showed survives.
     *
     * A STAGED flush never sets this. Staging carries a ladder and a modality,
     * not a compat decision, and the host autofill writes the knowledge base's
     * compat block into the very row it fills -- so clearing here would delete
     * the suggestion the row is supposed to start from (the same "the plugin's
     * own proposal is not a user decision" rule the ladder follows).
     */
    clearCompatKeys?: readonly string[];
}
export declare function effectiveStagedIntents(declaration: StagedDeclaration, current: Record<string, unknown> | undefined, autofill?: AutofillFootprint): EffectiveStagedIntents | null;
/** What this plugin's host autofill would write for one model, as the flush compares it. */
export interface AutofillFootprint {
    efforts?: ReasoningEfforts | false;
    input?: InputModalities;
}
/**
 * Drive the official per-row input-types control to a suggested declaration.
 *
 * Clicking an official checkbox is the path a user takes: its own onChange
 * replaces the row's draft, so the card reads as modified and its Save carries
 * the value. The alternative -- trusting the pending write to surface -- shows
 * the user nothing until that Save, which is exactly the gap this closes.
 *
 * Deliberately best-effort: a missing control, an unexpected box count or a
 * disabled box leaves the page exactly as it was.
 * @param container - the row's disclosure (where the official control lives).
 * @param input - the suggested modality set.
 */
export declare function syncOfficialInputTypes(container: HTMLElement, input: readonly string[]): void;
/**
 * Scan the settings DOM for official model rows and reconcile the injected
 * editors. Idempotent: existing editors are left alone, new disclosures get
 * one, and removed ones are unmounted.
 * @param root - the settings panel root to scan.
 * @param deps - the injection dependencies.
 * @param state - mutable scan state shared across invocations.
 */
export declare function reconcile(root: HTMLElement, deps: InjectorDeps, state: ScanState): void;
