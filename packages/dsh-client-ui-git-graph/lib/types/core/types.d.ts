/**
 * Wire vocabulary shared by the host git service and the browser client:
 * request/response shapes of the /git/* routes and the stable error codes
 * the client maps onto bilingual copy. Pure types — no runtime code.
 * @module dsh-git-graph/core/types
 */
/** One workspace-level repository snapshot (the branch chip's data). */
export interface RepoStatus {
    /** Canonical repository root (git rev-parse --show-toplevel). */
    root: string;
    /** Current branch name; empty when HEAD is detached. */
    branch: string;
    /** Short head commit id (first 7 hex chars). */
    head: string;
    /** Tracked modifications/deletions/additions in the worktree (porcelain count). */
    dirtyFiles: number;
    /** Untracked file count in the worktree. */
    untrackedFiles: number;
    /** Unresolved merge-conflict entry count. */
    conflicts: number;
    /** Whether a merge/rebase/cherry-pick/revert/bisect is in progress. */
    operationInProgress: boolean;
}
/** One local branch row (git for-each-ref refs/heads). */
export interface BranchRow {
    name: string;
    current: boolean;
}
/** The branch-list view (git for-each-ref refs/heads + worktree dirtiness). */
export interface BranchesView {
    root: string;
    /** Current branch name; empty when detached. */
    branch: string;
    branches: BranchRow[];
    dirtyFiles: number;
    untrackedFiles: number;
    conflicts: number;
    operationInProgress: boolean;
}
/** One linked worktree row (git worktree list --porcelain). */
export interface WorktreeInfo {
    /** Absolute worktree path. */
    path: string;
    /** Full HEAD oid of the worktree. */
    head: string;
    /** Checked-out branch short name; empty when detached or bare. */
    branch: string;
    /** Whether this is the primary checkout (first porcelain record). */
    main: boolean;
}
/** The worktree-list view. */
export interface WorktreeListView {
    root: string;
    worktrees: WorktreeInfo[];
}
/** Outcome of one worktree-add attempt. */
export type WorktreeAddResult = {
    ok: true;
    path: string;
    branch: string;
    name: string;
} | {
    ok: false;
    error: GitError;
};
/** Outcome of one worktree-remove attempt. */
export type WorktreeRemoveResult = {
    ok: true;
} | {
    ok: false;
    error: GitError;
};
/** Plugin feature config served to the browser (the /git/config view). */
export interface GitFeatureConfig {
    /** Auto-isolate every New Session of a git workspace into a fresh worktree. */
    autoIsolate: boolean;
    /** Baseline for auto-created worktrees: the checkout's current HEAD or the remote default branch. */
    autoBaseline: 'current' | 'default';
    /** Absolute prefix every plugin-managed worktree lives under. */
    worktreesHome: string;
}
/** Stable switch/create rejection codes (ZCode-style guard vocabulary). */
export type GitErrorCode = 'conflicts-present' | 'operation-in-progress' | 'branch-in-other-worktree' | 'tracked-changes-would-be-overwritten' | 'untracked-changes-would-be-overwritten' | 'target-branch-not-found' | 'invalid-branch-name' | 'branch-already-exists' | 'workspace-unknown' | 'invalid-worktree-name' | 'worktree-already-exists' | 'worktree-dirty' | 'worktree-not-found' | 'worktree-is-main' | 'base-ref-not-found' | 'internal';
/** One rejection with the copy key payload the client needs. */
export interface GitError {
    code: GitErrorCode;
    /** Human-readable message (host-authored English; the client prefers its own copy by code). */
    message: string;
    /** Files blocking the operation (the overwrite guards), first few only. */
    paths?: string[];
    /** Additional blocked-file count beyond `paths`. */
    moreFiles?: number;
}
/** Outcome of one switch/create attempt. */
export type SwitchResult = {
    ok: true;
    branch: string;
} | {
    ok: false;
    error: GitError;
};
/** One graph row (git log --topo-order with parents and decorations). */
export interface GraphCommit {
    oid: string;
    parents: string[];
    subject: string;
    author: string;
    /** Unix epoch seconds (git %at). */
    authorTime: number;
    /** Decoration ref names (branches/tags/HEAD), stripped of prefixes. */
    refs: string[];
}
/** The Git graph view. */
export interface GraphView {
    root: string;
    branch: string;
    commits: GraphCommit[];
    hasMore: boolean;
}
/** Parse output of `git for-each-ref refs/heads --format=...`. */
export declare function parseBranches(stdout: string): BranchRow[];
/** Parse `git worktree list --porcelain` into the branch refs checked out (porcelain prints `branch refs/heads/<name>`). */
export declare function parseWorktreeBranches(stdout: string): string[];
/**
 * Parse `git worktree list --porcelain` into full rows: blank-line-separated
 * records of `worktree <path>` / `HEAD <oid>` / `branch refs/heads/<name>`
 * (or `detached` / `bare`). The first record is the primary checkout.
 */
export declare function parseWorktrees(stdout: string): WorktreeInfo[];
/** Parse the porcelain status into counts. */
export declare function parsePorcelain(stdout: string): {
    dirtyFiles: number;
    untrackedFiles: number;
    conflicts: number;
};
/**
 * Parse the graph format rows (`%H %P %an %at %D %s` split by \x1e). `git
 * log` (tformat) appends a newline after the record separator, so every
 * record except the first carries a leading `\n` — strip it or the oid gets
 * corrupted and a trailing `\n` would parse as a phantom commit.
 */
export declare function parseGraph(stdout: string): GraphCommit[];
/** Decoration → ref names: split entries, drop the `HEAD -> ` handoff prefix, drop a bare detached-`HEAD` entry, drop `tag: `. */
export declare function parseDecoration(decoration: string): string[];
/** One rendered graph lane column. */
export type LaneGlyph = 'node' | 'pass' | 'merge' | 'gap';
/** A row's lane map: one glyph per lane column, left to right. */
export interface GraphRowLanes {
    /** Column glyphs; the node sits at `nodeColumn`. */
    columns: LaneGlyph[];
    nodeColumn: number;
    /** Whether this commit is a merge (≥2 parents). */
    merge: boolean;
}
/**
 * Minimal lane assignment over topo-ordered rows: each lane waits for one
 * commit; the first parent continues the node's lane, further parents start
 * (or join) lanes to the right. Correct for linear, branched, and merged
 * histories; the columns alone carry the topology (the renderer draws them
 * as monospace lane text).
 * @param rows - topo-ordered rows with parents (later rows = ancestors).
 * @returns per-row lane maps.
 */
export declare function computeLanes(rows: readonly GraphCommit[]): GraphRowLanes[];
/**
 * Runtime narrowing for the wire types served to the browser. Zod is not a
 * dependency of this package, so each guard is a hand-written structural
 * check over the same shape the host service produces. The routes boundary
 * runs these before sending a view so a malformed service output can never
 * leak to the client as a typed envelope value.
 * @module dsh-git-graph/core/types
 */
/** Narrow an unknown value onto {@link RepoStatus}. */
export declare function isRepoStatus(value: unknown): value is RepoStatus;
/** Narrow an unknown value onto {@link BranchRow}. */
export declare function isBranchRow(value: unknown): value is BranchRow;
/** Narrow an unknown value onto {@link BranchesView}. */
export declare function isBranchesView(value: unknown): value is BranchesView;
/** Narrow an unknown value onto {@link GraphCommit}. */
export declare function isGraphCommit(value: unknown): value is GraphCommit;
/** Narrow an unknown value onto {@link GraphView}. */
export declare function isGraphView(value: unknown): value is GraphView;
/** Narrow an unknown value onto {@link WorktreeInfo}. */
export declare function isWorktreeInfo(value: unknown): value is WorktreeInfo;
/** Narrow an unknown value onto {@link WorktreeListView}. */
export declare function isWorktreeListView(value: unknown): value is WorktreeListView;
/** Narrow an unknown value onto {@link GitFeatureConfig}. */
export declare function isGitFeatureConfig(value: unknown): value is GitFeatureConfig;
/** Narrow an unknown value onto {@link GitErrorCode}. */
export declare function isGitErrorCode(value: unknown): value is GitErrorCode;
/** Narrow an unknown value onto {@link GitError}. */
export declare function isGitError(value: unknown): value is GitError;
//# sourceMappingURL=types.d.ts.map