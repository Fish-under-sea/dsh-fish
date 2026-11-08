/**
 * Workspace targeting for cards that pin none.
 *
 * The Host answers three questions here instead of leaving them to
 * `session.create`, whose own fallback is the Host process working directory
 * (the desktop app's profile directory): which workspace a root card inherits
 * from the session that created it, which workspace an unpinned run lands in
 * when nothing could be inherited, and — when neither names one — the refusal
 * that stops the run instead of landing it there.
 *
 * Structural types only — the Host's `Workspace` entity satisfies them — so the
 * browser program compiles this module without importing an SDK value.
 *
 * @module dsh-task-board/core/workspace-target
 */
/** The workspace facts these rules read (a `Workspace` entity subset). */
export interface WorkspaceCandidate {
    /** Stable workspace record id. */
    readonly id: string;
    /** ISO-8601 instant of the workspace's last durable mutation. */
    readonly updatedAt: string;
    /** Header-validated session ids the workspace owns, most recent first. */
    readonly sessionIds: readonly string[];
}
/**
 * The workspace that owns one session.
 * @param items - the deployment's workspaces.
 * @param sessionId - the session whose workspace is requested.
 * @returns the owning workspace id, or undefined when none claims the session.
 */
export declare function workspaceOwningSession(items: readonly WorkspaceCandidate[], sessionId: string): string | undefined;
/**
 * The workspace the board treats as most recently used: the one whose record
 * changed last. Attaching a session stamps that instant, so the newest stamp
 * tracks where the user most recently opened or resumed a session. The
 * deployment's own list order breaks ties, and a stamp that does not parse
 * never outranks one that does; a registry whose stamps are all unreadable
 * falls back to list order rather than to "no workspace at all".
 * @param items - the deployment's workspaces.
 * @returns the most recently used workspace id, or undefined when there is none.
 */
export declare function mostRecentWorkspaceId(items: readonly WorkspaceCandidate[]): string | undefined;
/**
 * The failure text the Host records when a card names no workspace and the
 * deployment has none to resolve it to: the run is refused before any session
 * exists instead of letting `session.create` fall back to the Host process
 * working directory (the desktop app's profile directory), which is never the
 * project the user meant.
 *
 * A finished sentence rather than a code: the ledger stores it as the
 * execution's failure text, which the agent tools serve to a model and which
 * any client prints verbatim. It names the fix, not the mechanism.
 */
export declare const MISSING_WORKSPACE_REASON = "this card pins no workspace; choose a workspace on the card before running";
/**
 * Whether a recorded failure text is the missing-workspace refusal, which the
 * browser half renders in the reader's own language.
 * @param reason - the execution's recorded failure text.
 * @returns true when that run was refused for naming no workspace.
 */
export declare function isMissingWorkspaceReason(reason: string): boolean;
