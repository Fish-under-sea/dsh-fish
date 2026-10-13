/**
 * Browser client for the host /git/* routes: typed JSON envelope calls plus
 * the SSE change subscription. Same-origin relative fetch (the page and the
 * routes share the webserver).
 * @module dsh-git-graph/client/api
 */
import { subscribeSharedEvents } from "./sse-leader.js";
/** Transport failure (fetch threw or the response was not JSON). */
const TRANSPORT_ERROR = { code: 'internal', message: 'git route unavailable' };
/**
 * POST one JSON payload and decode the envelope; never throws.
 *
 * `path` is DOCUMENT-RELATIVE (no leading slash): the harness serves the GUI
 * with `<base href="./">`, so a sub-path deployment resolves the route
 * against its entry directory. A root-absolute path escapes that prefix and
 * never reaches the host route (issue #1707); the official client posts its
 * own routes the same way.
 */
async function post(path, payload) {
    let response;
    try {
        response = await fetch(path, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }
    catch {
        return { ok: false, error: TRANSPORT_ERROR };
    }
    try {
        const envelope = await response.json();
        if (typeof envelope !== 'object' || envelope === null)
            return { ok: false, error: TRANSPORT_ERROR };
        const record = envelope;
        if (record.ok === true)
            return { ok: true, value: record.value };
        return { ok: false, error: record.error ?? TRANSPORT_ERROR };
    }
    catch {
        return { ok: false, error: TRANSPORT_ERROR };
    }
}
/** Typed git operations over the wire. */
export class GitApi {
    /** The repository snapshot (null: not a git repository / not a workspace). */
    status(path) {
        return post('git/status', { path });
    }
    /** Local branch list with the current branch marked. */
    branches(path) {
        return post('git/branches', { path });
    }
    /** Workspace-level `git switch --no-guess <branch>` (host guards first). */
    switchBranch(path, branch) {
        return post('git/switch', { path, branch });
    }
    /** `git switch --no-guess -c <name>` from the current HEAD. */
    createBranch(path, name) {
        return post('git/create-branch', { path, name });
    }
    /** Topo-ordered commit graph across branches/tags/remotes. */
    graph(path, limit) {
        return post('git/graph', limit === undefined ? { path } : { path, limit });
    }
    /** All linked worktrees of the workspace's repository. */
    worktrees(path) {
        return post('git/worktrees', { path });
    }
    /** Create a managed worktree on a new wt/<name> branch (host picks the path). */
    addWorktree(path, name, baseRef) {
        return post('git/worktree-add', baseRef === undefined ? { path, name } : { path, name, baseRef });
    }
    /** Remove a managed worktree (dirty rejects unless force; deleteBranch drops the wt/ branch). */
    removeWorktree(path, worktreePath, opts) {
        return post('git/worktree-remove', { path, worktreePath, force: opts?.force === true, deleteBranch: opts?.deleteBranch === true });
    }
    /** The live feature config (auto-isolation flags + managed worktree home). */
    config() {
        return post('git/config', {});
    }
}
/**
 * Subscribe to host-pushed branch-state changes for one workspace path (the
 * host polls the workspace while a subscriber is connected). Reconnects are
 * handled by the EventSource; the caller re-subscribes when the path changes.
 * @param path - workspace root to watch.
 * @param onChange - fired on every pushed change.
 * @returns the disposer closing the stream.
 */
export function subscribeChanges(path, onChange) {
    // The stream is shared browser-wide through the cross-tab leader relay
    // (issue #383): two tabs of the same workspace must not pin two SSE
    // connections against the per-origin HTTP pool.
    return subscribeSharedEvents(`git/events?path=${encodeURIComponent(path)}`, 'change', () => { onChange(); });
}
