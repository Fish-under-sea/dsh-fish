/**
 * The daily token ceiling both spend gates share, as pure rules: the cap
 * comparison and the one refusal wording.
 *
 * The unit is tokens, not money. The usage ledger the board reads prices only
 * DeepSeek's own routes, so a cost cap would read 0 on every other route and
 * refuse nothing on exactly the deployments that need it. A cap of 0 is the
 * shipped default and means "no gate": both gates answer before they read a
 * file, subscribe to an event, or compute anything.
 * @module @fish-under-sea/dsh-client-ui-task-board-fish/core/spend-budget
 */
/** Token cap one board day may spend; 0 disables the gate. */
export declare const DEFAULT_SPEND_BUDGET_TOKENS = 0;
/**
 * Whether a day's measured spend already reached the cap.
 * @param usedTokens - tokens the day's spend measurement reported.
 * @param cap - the configured cap, 0 for "no gate".
 * @returns true when a run must be refused.
 */
export declare function spendCapReached(usedTokens: number, cap: number): boolean;
/**
 * The refusal text both gates report: the thrown message a client sees as
 * board-refused, and the scheduler error a due occurrence records.
 * @param usedTokens - tokens the day's spend measurement reported.
 * @param cap - the configured cap.
 * @returns the refusal message.
 */
export declare function spendCapMessage(usedTokens: number, cap: number): string;
