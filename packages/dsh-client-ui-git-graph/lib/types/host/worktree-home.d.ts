/**
 * Managed-worktree location: every plugin-created worktree lives under
 * `$DSH_HOME/worktrees/<repo-key>/<name>/` where repo-key pairs the
 * sanitized repository basename with a short hash of its canonical root, so
 * same-named repositories never collide. Host-only (node:crypto); the
 * browser learns the absolute prefix through the /git/config view.
 * @module dsh-git-graph/host/worktree-home
 */
/** The absolute directory every managed worktree family lives under. */
export declare function worktreesHome(): string;
/**
 * The stable key of one repository inside the managed home: sanitized
 * basename plus 8 hex chars of its canonical root's sha1.
 * @param root - canonical repository root (realpath'd).
 */
export declare function repoKeyFor(root: string): string;
/** The absolute path one named worktree of one repository would occupy. */
export declare function worktreePathFor(root: string, name: string): string;
/** The absolute directory holding every managed worktree of one repository. */
export declare function repoWorktreesDir(root: string): string;
/**
 * Containment check for removal: a managed worktree path must be a DIRECT
 * child of the repository's managed directory. Both inputs must already be
 * canonical (realpath'd) absolute paths — DSH_HOME may itself traverse
 * symlinks, so the call site canonicalizes the managed directory too.
 * @param dir - canonical managed directory (repoWorktreesDir output, resolved).
 * @param candidate - canonical worktree path.
 */
export declare function isManagedWorktreeOf(dir: string, candidate: string): boolean;
//# sourceMappingURL=worktree-home.d.ts.map