/**
 * Browser client for the host /git/* routes: typed JSON envelope calls plus
 * the SSE change subscription. Same-origin relative fetch (the page and the
 * routes share the webserver).
 * @module dsh-git-graph/client/api
 */
import type { BranchesView, GitError, GitFeatureConfig, GraphView, RepoStatus, WorktreeListView } from '../core/types.ts';
/** One /git envelope response. */
export type ApiResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: GitError;
};
/** Typed git operations over the wire. */
export declare class GitApi {
    /** The repository snapshot (null: not a git repository / not a workspace). */
    status(path: string): Promise<ApiResult<RepoStatus | null>>;
    /** Local branch list with the current branch marked. */
    branches(path: string): Promise<ApiResult<BranchesView | null>>;
    /** Workspace-level `git switch --no-guess <branch>` (host guards first). */
    switchBranch(path: string, branch: string): Promise<ApiResult<{
        branch: string;
    }>>;
    /** `git switch --no-guess -c <name>` from the current HEAD. */
    createBranch(path: string, name: string): Promise<ApiResult<{
        branch: string;
    }>>;
    /** Topo-ordered commit graph across branches/tags/remotes. */
    graph(path: string, limit?: number): Promise<ApiResult<GraphView | null>>;
    /** All linked worktrees of the workspace's repository. */
    worktrees(path: string): Promise<ApiResult<WorktreeListView | null>>;
    /** Create a managed worktree on a new wt/<name> branch (host picks the path). */
    addWorktree(path: string, name: string, baseRef?: string): Promise<ApiResult<{
        path: string;
        branch: string;
        name: string;
    }>>;
    /** Remove a managed worktree (dirty rejects unless force; deleteBranch drops the wt/ branch). */
    removeWorktree(path: string, worktreePath: string, opts?: {
        force?: boolean;
        deleteBranch?: boolean;
    }): Promise<ApiResult<{
        removed: true;
    }>>;
    /** The live feature config (auto-isolation flags + managed worktree home). */
    config(): Promise<ApiResult<GitFeatureConfig>>;
}
/**
 * Subscribe to host-pushed branch-state changes for one workspace path (the
 * host polls the workspace while a subscriber is connected). Reconnects are
 * handled by the EventSource; the caller re-subscribes when the path changes.
 * @param path - workspace root to watch.
 * @param onChange - fired on every pushed change.
 * @returns the disposer closing the stream.
 */
export declare function subscribeChanges(path: string, onChange: () => void): () => void;
//# sourceMappingURL=api.d.ts.map