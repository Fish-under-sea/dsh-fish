/**
 * Host git service: workspace-scoped git operations through a runner seam
 * (production: the subprocess service; tests: a plain child_process runner).
 * Guards mirror ZCode's branchSwitcher semantics — unresolved conflicts,
 * in-progress operations, and branches checked out in another worktree are
 * rejected with stable codes before any mutation.
 * @module dsh-git-graph/host/git-service
 */
import { existsSync } from 'node:fs';
import { mkdir, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { subprocessRunner as sharedSubprocessRunner } from "./git-runner.js";
import { branchDeleteForceArgv, checkRefFormatArgv, classifySwitchFailure, createBranchArgv, forEachRefArgv, gitPathArgv, graphLogArgv, headBranchArgv, operationMarkersArgv, OPERATION_MARKERS, sanitizeWorktreeName, statusPorcelainArgv, switchArgv, topLevelArgv, unmergedArgv, validateBranchName, verifyRefArgv, verifyRevArgv, worktreeAddArgv, worktreeListArgv, worktreeRemoveArgv, WORKTREE_BRANCH_PREFIX, } from "../core/git-command.js";
import { parseStatusV2, rootAndHeadArgv, statusV2BranchArgv } from "./status-porcelain.js";
import { parseBranches, parseGraph, parsePorcelain, parseWorktreeBranches, parseWorktrees, } from "../core/types.js";
import { isManagedWorktreeOf, repoWorktreesDir, worktreePathFor } from "./worktree-home.js";
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
export function gitSpawnArgv(platform, argv) {
    return platform === 'win32' ? ['git.exe', ...argv] : ['git', ...argv];
}
/**
 * Production runner over `ctx.subprocess`: shared plumbing with the win32
 * git.exe argv variant.
 * @param ctx - context carrying the subprocess service.
 * @returns the runner.
 */
export function subprocessRunner(ctx) {
    return sharedSubprocessRunner(ctx, { spawnArgv: (argv) => gitSpawnArgv(process.platform, argv) });
}
/** HEAD is the symbolic value `git rev-parse --abbrev-ref HEAD` prints when detached. */
const DETACHED = 'HEAD';
/** Rejection for a path outside the workspace registry. */
const WORKSPACE_UNKNOWN = {
    code: 'workspace-unknown',
    message: 'path is not a registered workspace',
};
/**
 * Workspace-scoped git operations. Every public method first passes the
 * workspace gate, then resolves the repository root from the requested path
 * and rejects non-repositories with `null` (or a rejection for mutations).
 */
export class GitService {
    runner;
    gate;
    /**
     * @param runner - the spawn seam.
     * @param gate - workspace-membership gate (host: canonical path ∈ registered workspace paths).
     */
    constructor(runner, gate) {
        this.runner = runner;
        this.gate = gate;
    }
    /** Status work currently running for each requested workspace path. */
    statusFlights = new Map();
    /**
     * The plumbing every read view shares: gate, repository root, current branch,
     * short head, the porcelain counts and the operation marker. Null when the
     * path is not a usable repository (the workspace-gate semantics both views
     * keep). Three spawns: one `rev-parse` for root+short-head, then the marker
     * probe and the status scan in parallel.
     */
    async snapshot(path, signal) {
        const gated = await this.gate(path);
        if (!gated.ok)
            return null;
        return this.plumbing(gated.canonical, signal);
    }
    /**
     * The repository snapshot the branch chip renders; null when not a repository.
     * Concurrent reads for the same requested workspace share one underlying
     * status task until it settles, preventing timed-out polls from accumulating.
     */
    status(path, signal) {
        const existing = this.statusFlights.get(path);
        if (existing !== undefined)
            return existing;
        const flight = this.statusFromPath(path, signal);
        this.statusFlights.set(path, flight);
        const clear = () => {
            if (this.statusFlights.get(path) === flight)
                this.statusFlights.delete(path);
        };
        void flight.then(clear, clear);
        return flight;
    }
    async statusFromPath(path, signal) {
        const gated = await this.gate(path);
        if (!gated.ok)
            return null;
        return this.statusFromGatedPath(gated.canonical, signal);
    }
    async statusFromGatedPath(path, signal) {
        const snap = await this.plumbing(path, signal);
        if (snap === null)
            return null;
        return {
            root: snap.root,
            branch: snap.branch,
            head: snap.head,
            dirtyFiles: snap.counts.dirtyFiles,
            untrackedFiles: snap.counts.untrackedFiles,
            conflicts: snap.counts.conflicts,
            operationInProgress: snap.operationInProgress,
        };
    }
    /**
     * Repository root and short head from ONE `rev-parse`. The combined call
     * prints the root first and the short id second; an unborn HEAD makes the
     * second half fail (exit 128) after the root has already been printed, which
     * is the same verdict as the previous separate probes (root resolved, head
     * empty). A path outside any repository prints nothing at all -> null.
     */
    async rootAndHead(path, signal) {
        const result = await this.runner.run(rootAndHeadArgv(), path, signal);
        const [rootLine = '', headLine = ''] = result.stdout.split('\n').map((line) => line.trim());
        return rootLine === '' ? null : { root: rootLine, head: headLine };
    }
    /** The three-spawn plumbing shared by `status` and `branches`. */
    async plumbing(path, signal) {
        const base = await this.rootAndHead(path, signal);
        if (base === null)
            return null;
        const [markers, status] = await Promise.all([
            this.runner.run(operationMarkersArgv(), base.root, signal),
            this.runner.run(statusV2BranchArgv(), base.root, signal),
        ]);
        const parsed = parseStatusV2(status.stdout);
        return {
            root: base.root,
            branch: parsed.branch,
            head: base.head,
            counts: parsed.counts,
            operationInProgress: await this.operationVerdict(base.root, markers, signal),
        };
    }
    /** Local branch list with the current branch marked (git for-each-ref refs/heads). */
    async branches(path) {
        const snap = await this.snapshot(path);
        if (snap === null)
            return null;
        const refs = await this.runner.run(forEachRefArgv(), snap.root);
        return {
            root: snap.root,
            branch: snap.branch,
            branches: parseBranches(refs.stdout),
            dirtyFiles: snap.counts.dirtyFiles,
            untrackedFiles: snap.counts.untrackedFiles,
            conflicts: snap.counts.conflicts,
            operationInProgress: snap.operationInProgress,
        };
    }
    /**
     * Switch the workspace's checked-out branch: real `git switch --no-guess`
     * on disk, affecting every session in the workspace (never a per-session
     * override). Guards run before the mutation; switch failures classify onto
     * the stable error codes.
     * @param path - workspace root.
     * @param branch - existing local branch name.
     */
    async switchBranch(path, branch) {
        const gated = await this.gate(path);
        if (!gated.ok)
            return { ok: false, error: WORKSPACE_UNKNOWN };
        const root = await this.repoRoot(gated.canonical);
        if (root === null)
            return { ok: false, error: { code: 'internal', message: 'not a git repository' } };
        const formatted = await this.runner.run(checkRefFormatArgv(branch), root);
        if (formatted.exitCode !== 0) {
            return { ok: false, error: { code: 'invalid-branch-name', message: formatted.stderr.trim() || 'invalid branch name' } };
        }
        const verified = await this.runner.run(verifyRefArgv(branch), root);
        if (verified.exitCode !== 0) {
            return { ok: false, error: { code: 'target-branch-not-found', message: `branch "${branch}" does not exist locally` } };
        }
        const currentResult = await this.runner.run(headBranchArgv(), root);
        const current = currentResult.stdout.trim();
        if (current === branch)
            return { ok: true, branch };
        const blocked = await this.guardBlock(root, branch);
        if (blocked !== null)
            return { ok: false, error: blocked };
        const switched = await this.runner.run(switchArgv(branch), root);
        if (switched.exitCode === 0)
            return { ok: true, branch };
        return { ok: false, error: classifySwitchFailure(switched.stderr) };
    }
    /**
     * Create a branch from the current HEAD and switch to it
     * (`git switch --no-guess -c <name>`). The authoritative name gate is
     * `git check-ref-format --branch`; duplicates are rejected up front.
     * @param path - workspace root.
     * @param name - proposed branch name.
     */
    async createBranch(path, name) {
        const mirrorReason = validateBranchName(name);
        if (mirrorReason !== null) {
            return { ok: false, error: { code: 'invalid-branch-name', message: `invalid branch name: ${mirrorReason}` } };
        }
        const gated = await this.gate(path);
        if (!gated.ok)
            return { ok: false, error: WORKSPACE_UNKNOWN };
        const root = await this.repoRoot(gated.canonical);
        if (root === null)
            return { ok: false, error: { code: 'internal', message: 'not a git repository' } };
        const formatted = await this.runner.run(checkRefFormatArgv(name), root);
        if (formatted.exitCode !== 0) {
            return { ok: false, error: { code: 'invalid-branch-name', message: formatted.stderr.trim() || 'invalid branch name' } };
        }
        // Single-ref probe instead of listing (and locale-sorting) every branch.
        const exists = await this.runner.run(verifyRefArgv(name), root);
        if (exists.exitCode === 0) {
            return { ok: false, error: { code: 'branch-already-exists', message: `branch "${name}" already exists` } };
        }
        const blocked = await this.guardBlock(root, undefined);
        if (blocked !== null)
            return { ok: false, error: blocked };
        const created = await this.runner.run(createBranchArgv(name), root);
        if (created.exitCode === 0)
            return { ok: true, branch: name };
        return { ok: false, error: classifySwitchFailure(created.stderr) };
    }
    /** Topo-ordered commit graph across branches/tags/remotes (read-only). */
    async graph(path, limit = 200) {
        const gated = await this.gate(path);
        if (!gated.ok)
            return null;
        const root = await this.repoRoot(gated.canonical);
        if (root === null)
            return null;
        const [logResult, branchResult] = await Promise.all([
            this.runner.run(graphLogArgv(limit + 1), root),
            this.runner.run(headBranchArgv(), root),
        ]);
        const commits = parseGraph(logResult.stdout);
        const hasMore = commits.length > limit;
        const branch = branchResult.stdout.trim();
        return {
            root,
            branch: branch === DETACHED ? '' : branch,
            commits: hasMore ? commits.slice(0, limit) : commits,
            hasMore,
        };
    }
    /** All linked worktrees of the workspace's repository (read-only). */
    async worktrees(path, signal) {
        const gated = await this.gate(path);
        if (!gated.ok)
            return null;
        const root = await this.repoRoot(gated.canonical, signal);
        if (root === null)
            return null;
        const result = await this.runner.run(worktreeListArgv(), root, signal);
        if (result.exitCode !== 0)
            return null;
        return { root, worktrees: parseWorktrees(result.stdout) };
    }
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
    async addWorktree(path, rawName, baseRef) {
        const name = sanitizeWorktreeName(rawName);
        if (name === null) {
            return { ok: false, error: { code: 'invalid-worktree-name', message: `invalid worktree name: ${JSON.stringify(rawName)}` } };
        }
        const gated = await this.gate(path);
        if (!gated.ok)
            return { ok: false, error: WORKSPACE_UNKNOWN };
        const root = await this.repoRoot(gated.canonical);
        if (root === null)
            return { ok: false, error: { code: 'internal', message: 'not a git repository' } };
        const branch = WORKTREE_BRANCH_PREFIX + name;
        const formatted = await this.runner.run(checkRefFormatArgv(branch), root);
        if (formatted.exitCode !== 0) {
            return { ok: false, error: { code: 'invalid-worktree-name', message: formatted.stderr.trim() || 'invalid worktree name' } };
        }
        const branchExists = await this.runner.run(verifyRefArgv(branch), root);
        if (branchExists.exitCode === 0) {
            return { ok: false, error: { code: 'worktree-already-exists', message: `branch "${branch}" already exists` } };
        }
        const target = worktreePathFor(root, name);
        if (existsSync(target)) {
            return { ok: false, error: { code: 'worktree-already-exists', message: `worktree path already exists: ${target}` } };
        }
        // Base-ref resolution: default HEAD; an explicit origin/HEAD without a
        // remote falls back to HEAD (the worktree must still be creatable).
        let base = baseRef === undefined || baseRef.trim() === '' ? 'HEAD' : baseRef.trim();
        const verified = await this.runner.run(verifyRevArgv(base), root);
        if (verified.exitCode !== 0) {
            if (base === 'origin/HEAD') {
                base = 'HEAD';
            }
            else {
                return { ok: false, error: { code: 'base-ref-not-found', message: `base ref "${base}" does not resolve` } };
            }
        }
        if (await this.operationInProgress(root)) {
            return { ok: false, error: { code: 'operation-in-progress', message: 'a git operation is in progress' } };
        }
        await mkdir(repoWorktreesDir(root), { recursive: true });
        const added = await this.runner.run(worktreeAddArgv(target, branch, base), root);
        if (added.exitCode === 0)
            return { ok: true, path: target, branch, name };
        return { ok: false, error: classifySwitchFailure(added.stderr) };
    }
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
    async removeWorktree(path, worktreePath, opts = {}) {
        const gated = await this.gate(path);
        if (!gated.ok)
            return { ok: false, error: WORKSPACE_UNKNOWN };
        const root = await this.repoRoot(gated.canonical);
        if (root === null)
            return { ok: false, error: { code: 'internal', message: 'not a git repository' } };
        let canonical;
        try {
            canonical = await realpath(worktreePath);
        }
        catch {
            return { ok: false, error: { code: 'worktree-not-found', message: `worktree path does not resolve: ${worktreePath}` } };
        }
        // Containment compares canonical paths on BOTH sides: DSH_HOME itself
        // may traverse symlinks (macOS /var -> /private/var), so the lexical
        // home prefix and the realpath'd candidate would otherwise never match.
        let canonicalHome;
        try {
            canonicalHome = await realpath(repoWorktreesDir(root));
        }
        catch {
            return { ok: false, error: { code: 'worktree-not-found', message: 'this repository has no managed worktree directory' } };
        }
        if (!isManagedWorktreeOf(canonicalHome, canonical)) {
            return { ok: false, error: { code: 'worktree-not-found', message: 'not a managed worktree of this repository' } };
        }
        const listed = await this.runner.run(worktreeListArgv(), root);
        // git reports worktree paths as spelled at add time (possibly
        // symlinked); canonicalize each row before comparing.
        let entry;
        for (const item of parseWorktrees(listed.stdout)) {
            try {
                if (await realpath(item.path) === canonical) {
                    entry = item;
                    break;
                }
            }
            catch {
                // A stale row whose directory vanished cannot be the removal target.
            }
        }
        if (entry === undefined) {
            return { ok: false, error: { code: 'worktree-not-found', message: `git does not list ${canonical} as a worktree` } };
        }
        if (entry.main) {
            return { ok: false, error: { code: 'worktree-is-main', message: 'the primary checkout cannot be removed' } };
        }
        if (opts.force !== true) {
            const porcelain = await this.runner.run(statusPorcelainArgv(), canonical);
            const counts = parsePorcelain(porcelain.stdout);
            if (counts.dirtyFiles + counts.untrackedFiles + counts.conflicts > 0) {
                return { ok: false, error: { code: 'worktree-dirty', message: 'the worktree has uncommitted changes' } };
            }
            if (await this.operationInProgress(canonical)) {
                return { ok: false, error: { code: 'operation-in-progress', message: 'a git operation is in progress in the worktree' } };
            }
        }
        const removed = await this.runner.run(worktreeRemoveArgv(canonical, opts.force === true), root);
        if (removed.exitCode !== 0) {
            return { ok: false, error: { code: 'internal', message: removed.stderr.trim() || 'git worktree remove failed' } };
        }
        if (opts.deleteBranch === true && entry.branch.startsWith(WORKTREE_BRANCH_PREFIX)) {
            await this.runner.run(branchDeleteForceArgv(entry.branch), root);
        }
        return { ok: true };
    }
    /** Repository root of a canonical path, or null when not inside a git repository. */
    async repoRoot(path, signal) {
        const result = await this.runner.run(topLevelArgv(), path, signal);
        if (result.exitCode !== 0)
            return null;
        const root = result.stdout.trim();
        return root === '' ? null : root;
    }
    /** Whether any git operation marker is present in the repository. */
    async operationInProgress(root, signal) {
        // Preferred path: one spawn for all seven markers (Windows: 7 git.exe
        // cold starts -> 1). --git-path prints a repo-relative path for in-repo
        // markers (and an absolute one for worktree/linked stores); resolve
        // covers both.
        const resolved = await this.runner.run(operationMarkersArgv(), root, signal);
        return this.operationVerdict(root, resolved, signal);
    }
    /**
     * Marker verdict from an already-run combined probe (the status plumbing
     * runs it in parallel with the status scan), with the per-marker fallback
     * kept for a non-zero combined exit.
     */
    async operationVerdict(root, resolved, signal) {
        if (resolved.exitCode === 0) {
            const markerPaths = resolved.stdout
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line !== '');
            return markerPaths.some((markerPath) => existsSync(resolve(root, markerPath)));
        }
        // Non-zero combined exit: fall back to the per-marker sequential probe
        // (same as the pre-merge implementation) so a single failed rev-parse
        // cannot silently hide an in-progress operation. Every marker is probed
        // and the verdict is true when any path exists; all-missing returns false.
        let inProgress = false;
        for (const marker of OPERATION_MARKERS) {
            const single = await this.runner.run(gitPathArgv(marker), root, signal);
            const markerPath = single.stdout.trim();
            if (markerPath !== '' && existsSync(resolve(root, markerPath)))
                inProgress = true;
        }
        return inProgress;
    }
    /**
     * The pre-switch guards (ZCode branchSwitcher semantics): unresolved
     * conflicts, in-progress operations, and a target already checked out in
     * another worktree.
     * @param root - repository root.
     * @param target - target branch; undefined for create (worktree check skipped).
     * @returns the rejection, or null when the switch may proceed.
     */
    async guardBlock(root, target) {
        const [conflicts, inProgress, worktrees] = await Promise.all([
            this.runner.run(unmergedArgv(), root),
            this.operationInProgress(root),
            target === undefined ? Promise.resolve(null) : this.runner.run(worktreeListArgv(), root),
        ]);
        const conflictCount = conflicts.stdout.split('\n').filter(line => line !== '').length;
        if (conflictCount > 0) {
            return { code: 'conflicts-present', message: `repository has ${conflictCount} unresolved conflict(s)` };
        }
        if (inProgress) {
            return { code: 'operation-in-progress', message: 'a git operation is in progress' };
        }
        if (target !== undefined && worktrees !== null && parseWorktreeBranches(worktrees.stdout).includes(target)) {
            return { code: 'branch-in-other-worktree', message: `branch "${target}" is checked out in another worktree` };
        }
        return null;
    }
}
