/**
 * Workspace targeting for cards that pin none.
 *
 * The Host answers two questions here instead of leaving them to
 * `session.create`, whose own fallback is the Host process working directory
 * (the desktop app's profile directory): which workspace a root card inherits
 * from the session that created it, and which workspace an unpinned run lands
 * in when nothing could be inherited.
 *
 * Structural types only — the Host's `Workspace` entity satisfies them — so the
 * browser program compiles this module without importing an SDK value.
 *
 * @module dsh-task-board/core/workspace-target
 */

/** The workspace facts these rules read (a `Workspace` entity subset). */
export interface WorkspaceCandidate {
  /** Stable workspace record id. */
  readonly id: string
  /** ISO-8601 instant of the workspace's last durable mutation. */
  readonly updatedAt: string
  /** Header-validated session ids the workspace owns, most recent first. */
  readonly sessionIds: readonly string[]
}

/**
 * The workspace that owns one session.
 * @param items - the deployment's workspaces.
 * @param sessionId - the session whose workspace is requested.
 * @returns the owning workspace id, or undefined when none claims the session.
 */
export function workspaceOwningSession(
  items: readonly WorkspaceCandidate[],
  sessionId: string,
): string | undefined {
  return items.find(item => item.sessionIds.includes(sessionId))?.id
}

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
export function mostRecentWorkspaceId(items: readonly WorkspaceCandidate[]): string | undefined {
  let best: WorkspaceCandidate | undefined
  let bestAt = Number.NEGATIVE_INFINITY
  for (const item of items) {
    const at = Date.parse(item.updatedAt)
    if (!Number.isFinite(at) || at <= bestAt) continue
    best = item
    bestAt = at
  }
  return best?.id ?? items[0]?.id
}
