/**
 * Workspace-domain mutations for dsh-session-archive. Archive and unarchive
 * both go through public registry verbs: `archiveSession` existed at
 * 0.1.5-rc.1, and 0.1.6-alpha.1 added `unarchiveSession`, which retired the
 * earlier workaround that reached into the registry's private
 * `requireState`/`setState` domain handles to edit the archive set itself.
 * Workspace-row cleanup (physical delete only) still uses the entity
 * `mutate` path, which has no public equivalent. Every write flows through
 * the domain storage, so the workspace feed publishes follow frames and every
 * connected browser sees the change without a reload. The seams are
 * feature-detected and pinned to the SDK cohort; when absent, operations fail
 * with `missing-seam` instead of guessing at files.
 * @module @fish-under-sea/dsh-session-archive/host/workspace-store
 */
import type { Context } from '@deepseek-ai/cordis';
export interface WorkspaceRecordLike {
    path: string;
    title: string;
    sessionIds: string[];
    createdAt: string;
    updatedAt: string;
}
/** Whether the public unarchive verb is present on this registry instance. */
export declare function unarchiveSeamAvailable(registry: unknown): boolean;
/**
 * Remove ids from the registry-global archive set through the public
 * `workspaceRegistry.unarchiveSession` verb. Idempotent for ids that are not
 * archived (the verb resolves without writing). Callers pass the harness's
 * native id spelling, because the stored set mixes spellings.
 */
export declare function unarchiveSessions(registry: unknown, ids: readonly string[]): Promise<void>;
/**
 * Archive one session through the public verb. Idempotent for already
 * archived ids; throws when the session does not exist live or in
 * persistence.
 */
export declare function archiveSession(ctx: Context, id: string): Promise<void>;
/**
 * Remove ids from every workspace's durable `sessionIds` account. Goes
 * through the entity `mutate` path (durable table update + record refresh +
 * feed upsert). Returns the ids actually removed from at least one row.
 */
export declare function removeFromWorkspaceRows(registry: unknown, ids: readonly string[]): Promise<string[]>;
