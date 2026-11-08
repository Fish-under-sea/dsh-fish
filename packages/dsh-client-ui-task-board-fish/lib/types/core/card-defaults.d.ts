/**
 * New-card defaults: the execution targets a freshly created card starts from,
 * and how they combine with what the caller picked and with the card a subtask
 * or a duplicate is created from.
 *
 * Framework-free (no cordis, no runtime imports) because BOTH halves compile
 * it: the Host resolves the seed when it writes the card, and the browser
 * resolves the same seed to open the new-task dialog on it. One pure function
 * is the only place the rules live, so the dialog and the ledger cannot drift.
 *
 * Every target is resolved in ONE order: what the caller picked wins over the
 * value carried over from the card this one is created from, which wins over
 * the board's new-card defaults, and a target nothing supplies stays blank
 * ("no pin, resolved at run time"). A duplicate is a copy of its source and a
 * subtask is derived from its parent, so both keep the source's own pins and
 * fill only the fields that source left unset.
 *
 * The permission of a PARENT is the one exception: it never participates. The
 * permission is not copied onto a card at creation — doing so would also have
 * to copy the parent's human confirmation to stay runnable, and a detached
 * child would keep both, so one confirmed parent would mint unbounded confirmed
 * elevated roots. It is resolved along the ancestor chain at launch instead
 * (core/subtask.ts), which is what makes detaching remove the inheritance by
 * construction. A duplicate is not a hierarchy link, so it copies the
 * permission like every other target. The board's own default permission is not
 * a parent binding either and does apply to a subtask; it only pre-fills the
 * card, and a value above the session baseline still needs a human
 * confirmation before the card may run.
 *
 * The reasoning level is bound to the model route it was chosen for and never
 * crosses to another one:
 *
 *   - a level the caller picked is used as it stands;
 *   - a caller that pinned a model of its own inherits no level at all, not
 *     even one the same model happens to carry on the source card;
 *   - otherwise the source card's level travels with the source value it was
 *     stored on, exactly as the card's own model/level pair does, and wins over
 *     the board default level, so a board that configures none behaves exactly
 *     as the create path always has;
 *   - a board default level applies only while the card's final model IS the
 *     configured default model, and a blank default model makes it inert —
 *     a level the resolved model does not declare could only be refused by
 *     model selection at run time.
 */
import type { TaskRecord } from './tasks.ts';
/** The board's configured new-card defaults; a blank target means "not set". */
export interface CardDefaults {
    /** Agent preset a new card starts from. */
    mode?: string;
    /** Permission a new card starts from. */
    permission?: string;
    /** Model a new card starts from. */
    model?: string;
    /** Reasoning level a new card starts from, for the model above. */
    reasoningEffort?: string;
}
/** The card a new one is created from, and how it is derived from it. */
export interface CardTargetSource {
    /** A copy of the source card, or a subtask of it. */
    kind: 'duplicate' | 'parent';
    /** The source card's execution targets. */
    task: Pick<TaskRecord, 'mode' | 'permission' | 'model' | 'reasoningEffort'>;
}
/** The resolved targets of the card about to be created; blank means "unset". */
export interface CardTargetSeed {
    mode: string;
    permission: string;
    model: string;
    reasoningEffort: string;
}
/**
 * Resolve the execution targets a new card starts from.
 * @param defaults - the board's configured new-card defaults, if any.
 * @param source - the card this one is created from (a duplicate or a parent), if any.
 * @param picked - what the caller chose explicitly; a non-blank value wins.
 * @returns the four targets, blank where nothing supplies a value.
 */
export declare function resolveCardTargets(defaults: CardDefaults | undefined, source: CardTargetSource | undefined, picked?: Partial<CardTargetSeed>): CardTargetSeed;
