/**
 * Host git service: workspace-scoped git operations through a runner seam
 * (production: the subprocess service; tests: a plain child_process runner).
 * Guards mirror ZCode's branchSwitcher semantics — unresolved conflicts,
 * in-progress operations, and branches checked out in another worktree are
 * rejected with stable codes before any mutation.
 * @module dsh-git-graph/host/git-service
 */
import type { Context } from '@deepseek-ai/cordis';
import { type GitRunner } from './git-runner.ts';
import { type BranchesView, type GitError, type GraphView, type RepoStatus, type SwitchResult, type WorktreeAddResult, type WorktreeListView, type WorktreeRemoveResult } from '../core/types.ts';
/** One finished git invocation (shared runner plumbing). */
export type { GitRunResult, GitRunner } from './git-runner.ts';
/**
 * Build the argv for one git invocation, with the win32 binary variant.
 * Windows ships git as git.exe (git for Windows); a .cmd/.bat shim in PATH
 * would otherwise be the resolution target and Node's spawn cannot launch
 * a .cmd file directly (the dsh-subprocess seam applies no shell). Naming
 * git.exe bypasses any shim and always hits the native executable. cmd.exe
 * routing is deliberately NOT used: several git args carry %-format specs
 * (for-each-ref/log --format) that cmd would expand and corrupt.
 * @param platform - the process platform (process.platform in production; a test seam).
 * @param argv - the git subcommand args.
 * @returns the full spawn argv, starting with the platform git binary.
 */
export declare function gitSpawnArgv(platform: NodeJS.Platform, argv: readonly string[]): readonly string[];
/** The workspace-membership verdict type. */
export type WorkspaceVerdict = {
    ok: true;
    canonical: string;
} | {
    ok: false;
    error: GitError;
};
/**
 * Workspace-membership gate: canonicalize the requested path and require it
 * to equal a registered workspace path (the host's realpath canon). This is
 * the security boundary of the /git routes — the browser may only run git on
 * workspace roots.
 */
export type WorkspaceGate = (path: string) => Promise<WorkspaceVerdict>;
/**
 * Production runner over `ctx.subprocess`: shared plumbing with the win32
 * git.exe argv variant.
 * @param ctx - context carrying the subprocess service.
 * @returns the runner.
 */
export declare function subprocessRunner(ctx: Context): GitRunner;
/**
 * Workspace-scoped git operations. Every public method first passes the
 * workspace gate, then resolves the repository root from the requested path
 * and rejects non-repositories with `null` (or a rejection for mutations).
 */
export declare class GitService {
    private readonly runner;
    private readonly gate;
    /**
     * @param runner - the spawn seam.
     * @param gate - workspace-membership gate (host: canonical path ∈ registered workspace paths).
     */
    constructor(runner: GitRunner, gate: WorkspaceGate);
    /** Status work currently running for each requested workspace path. */
    private readonly statusFlights;
    /**
     * The plumbing every read view shares: gate, repository root, current branch,
     * short head, the porcelain counts and the operation marker. Null when the
     * path is not a usable repository (the workspace-gate semantics both views
     * keep). Three spawns: one `rev-parse` for root+short-head, then the marker
     * probe and the status scan in parallel.
     */
    private snapshot;
    /**
     * The repository snapshot the branch chip renders; null when not a repository.
     * Concurrent reads for the same requested workspace share one underlying
     * status task until it settles, preventing timed-out polls from accumulating.
     */
    status(path: string, signal?: AbortSignal): Promise<RepoStatus | null>;
    private statusFromPath;
    private statusFromGatedPath;
    /**
     * Repository root and short head from ONE `rev-parse`. The combined call
     * prints the root first and the short id second; an unborn HEAD makes the
     * second half fail (exit 128) after the root has already been printed, which
     * is the same verdict as the previous separate probes (root resolved, head
     * empty). A path outside any repository prints nothing at all -> null.
     */
    private rootAndHead;
    /** The three-spawn plumbing shared by `status` and `branches`. */
    private plumbing;
    /** Local branch list with the current branch marked (git for-each-ref refs/heads). */
    branches(path: string): Promise<BranchesView | null>;
    /**
     * Switch the workspace's checked-out branch: real `git switch --no-guess`
     * on disk, affecting every session in the workspace (never a per-session
     * override). Guards run before the mutation; switch failures classify onto
     * the stable error codes.
     * @param path - workspace root.
     * @param branch - existing local branch name.
     */
    switchBranch(path: string, branch: string): Promise<SwitchResult>;
    /**
     * Create a branch from the current HEAD and switch to it
     * (`git switch --no-guess -c <name>`). The authoritative name gate is
     * `git check-ref-format --branch`; duplicates are rejected up front.
     * @param path - workspace root.
     * @param name - proposed branch name.
     */
    createBranch(path: string, name: string): Promise<SwitchResult>;
    /** Topo-ordered commit graph across branches/tags/remotes (read-only). */
    graph(path: string, limit?: number): Promise<GraphView | null>;
    /** All linked worktrees of the workspace's repository (read-only). */
    worktrees(path: string, signal?: AbortSignal): Promise<WorktreeListView | null>;
    /**
     * Create a managed worktree: `git worktree add -b wt/<name> <target> <baseRef>`
     * under $DSH_HOME/worktrees/<repo-key>/<name>/. The target path is ALWAYS
     * host-constructed (the caller supplies only a name, never a path), and the
     * worktree always checks out a NEW wt/ branch — git allows one branch in
     * one checkout, so reusing the base branch would break the main checkout.
     * @param path - workspace root.
     * @param rawName - proposed worktree name (sanitized; collisions reject).
     * @param baseRef - base revision; omitted means the checkout's current HEAD,
     *   and an unresolvable 'origin/HEAD' falls back to HEAD (no remote).
     */
    addWorktree(path: string, rawName: string, baseRef?: string): Promise<WorktreeAddResult>;
    /**
     * Remove a managed worktree. Containment is enforced twice: the canonical
     * target must be a direct child of the repository's managed directory, and
     * it must appear in `git worktree list`. A dirty worktree (or one with an
     * in-progress operation) rejects unless force is set; deleteBranch removes
     * the wt/ branch afterwards and only ever applies to that prefix.
     * @param path - workspace root.
     * @param worktreePath - the worktree to remove (any spelling; canonicalized here).
     * @param opts - force overrides the dirtiness guard; deleteBranch drops the wt/ branch.
     */
    removeWorktree(path: string, worktreePath: string, opts?: {
        force?: boolean;
        deleteBranch?: boolean;
    }): Promise<WorktreeRemoveResult>;
    /** Repository root of a canonical path, or null when not inside a git repository. */
    private repoRoot;
    /** Whether any git operation marker is present in the repository. */
    private operationInProgress;
    /**
     * Marker verdict from an already-run combined probe (the status plumbing
     * runs it in parallel with the status scan), with the per-marker fallback
     * kept for a non-zero combined exit.
     */
    private operationVerdict;
    /**
     * The pre-switch guards (ZCode branchSwitcher semantics): unresolved
     * conflicts, in-progress operations, and a target already checked out in
     * another worktree.
     * @param root - repository root.
     * @param target - target branch; undefined for create (worktree check skipped).
     * @returns the rejection, or null when the switch may proceed.
     */
    private guardBlock;
}
//# sourceMappingURL=git-service.d.ts.map