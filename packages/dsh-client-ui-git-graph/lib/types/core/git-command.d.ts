/**
 * Git command vocabulary: argv builders, stderr classification, and the
 * pure branch-name validation mirror. The host service runs these through
 * the subprocess seam; tests exercise this layer with a plain runner.
 * @module dsh-git-graph/core/git-command
 */
import type { GitError } from './types.ts';
/** `git rev-parse --show-toplevel` — canonical repository root. */
export declare const topLevelArgv: () => string[];
/** `git rev-parse --abbrev-ref HEAD` — current branch ('HEAD' when detached). */
export declare const headBranchArgv: () => string[];
/** `git for-each-ref refs/heads --format=%(refname:short)%00%(HEAD)%00%(objectname)` — local branches. */
export declare const forEachRefArgv: () => string[];
/** `git status --porcelain` — worktree dirtiness and conflicts. */
export declare const statusPorcelainArgv: () => string[];
/** `git diff --name-only --diff-filter=U` — unmerged (conflict) files. */
export declare const unmergedArgv: () => string[];
/** `git worktree list --porcelain` — all worktrees and their checked-out branches. */
export declare const worktreeListArgv: () => string[];
/** `git worktree add -b <branch> <path> <baseRef>` — a linked worktree on a NEW branch. */
export declare const worktreeAddArgv: (path: string, branch: string, baseRef: string) => string[];
/** `git worktree remove [--force] <path>` — remove a linked worktree. */
export declare const worktreeRemoveArgv: (path: string, force: boolean) => string[];
/** `git branch -D <name>` — force-delete a branch (only for opted-in wt/ cleanup after removal). */
export declare const branchDeleteForceArgv: (name: string) => string[];
/** `git rev-parse --verify --quiet <rev>` — generic revision probe (base refs such as origin/HEAD). */
export declare const verifyRevArgv: (rev: string) => string[];
/** Branch prefix every plugin-created worktree checks out (never the base branch itself). */
export declare const WORKTREE_BRANCH_PREFIX = "wt/";
/**
 * Sanitize a user/agent-supplied worktree name into a safe directory and
 * branch component: lowercase, alnum plus ._-, no leading/trailing dash/dot,
 * capped at 64 chars. Returns null when nothing usable remains.
 * @param raw - the proposed worktree name.
 */
export declare function sanitizeWorktreeName(raw: string): string | null;
/** `git rev-parse --verify --quiet refs/heads/<branch>` — branch existence probe. */
export declare const verifyRefArgv: (branch: string) => string[];
/** `git check-ref-format --branch <name>` — the authoritative branch-name gate. */
export declare const checkRefFormatArgv: (name: string) => string[];
/** `git switch --no-guess -- <branch>` — workspace-level branch switch (ZCode semantics). */
export declare const switchArgv: (branch: string) => string[];
/** `git switch --no-guess -c <name>` — create from current HEAD and switch. */
export declare const createBranchArgv: (name: string) => string[];
/** Graph log: `git log --branches --tags --remotes --topo-order --parents --format=... --max-count <n>`. */
export declare const graphLogArgv: (limit: number) => string[];
/** Git markers whose presence means an operation is in progress. */
export declare const OPERATION_MARKERS: readonly ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "BISECT_LOG", "rebase-merge", "rebase-apply", "sequencer"];
/**
 * git rev-parse --git-path <marker> - resolve ONE operation marker to its
 * on-disk path. Kept as the per-marker probe for the service's fallback
 * when the single combined spawn fails (a hung or non-zero combined call
 * must not silently hide an in-progress operation).
 */
export declare const gitPathArgv: (marker: string) => string[];
/**
 * git rev-parse --git-path <marker>... - resolve every operation-marker path
 * in ONE spawn (one --git-path option per marker; the option form is
 * repeatable, unlike positional paths). On Windows, where each git.exe cold
 * start costs about 0.7s, this replaces the previous 7 sequential marker
 * probes with a single process.
 */
export declare const operationMarkersArgv: () => string[];
/**
 * Extract the blocked-file list following an overwrite header: git indents
 * paths with a tab (quoted when they contain spaces); the trailing hint
 * lines ("Please commit your changes...") end the list.
 * @param stderr - the full git stderr.
 * @param header - the matched header regex.
 * @returns up to two file paths plus the count of remaining files.
 */
export declare function extractBlockedPaths(stderr: string, header: RegExp): {
    paths: string[];
    moreFiles: number;
};
/**
 * Classify a failed switch's stderr onto the stable error vocabulary.
 * @param stderr - git stderr from the failed switch/create.
 * @returns the classified error; `internal` when nothing matches.
 */
export declare function classifySwitchFailure(stderr: string): GitError;
/**
 * Pure mirror of `git check-ref-format --branch` short-name rules, for
 * instant client-side feedback; the host's check-ref-format call stays the
 * authoritative gate. Returns the reason when the name is invalid.
 * @param name - proposed branch name (short form, no refs/ prefix).
 * @returns null when valid, else a short reason.
 */
export declare function validateBranchName(name: string): string | null;
//# sourceMappingURL=git-command.d.ts.map