/**
 * Bounded reuse of one sessions-root directory index across inventory passes.
 *
 * Assembling the inventory walks every session directory to sum its file
 * sizes; on a root with hundreds of sessions that walk dominates the pass.
 * The panel loads the inventory, refreshes it, opens previews and issues one
 * batch request per chunk, so the same unchanged tree is re-walked several
 * times inside a few seconds. This cache serves the previous scan inside a
 * bounded window instead.
 *
 * Reuse is only sound while the tree has not changed underneath us, so the
 * window is short and the owner must invalidate explicitly after it removes
 * session storage itself. Nothing here polls or accumulates: one entry, and a
 * scan is always one call away. The window rule itself lives in
 * {@link TtlMemo}, which the projection-cache index memo shares.
 *
 * @module @fish-under-sea/dsh-session-archive/host/dir-index-cache
 */
import type { SessionDirIndex } from './session-files.ts';
/** Collaborators of one cache instance. */
export interface DirIndexCacheOptions {
    /** How long a scan may be reused, in milliseconds. */
    ttlMs: number;
    /** Performs the real directory scan. */
    scan: () => SessionDirIndex;
    /** Clock reading; defaults to wall time. Injected for deterministic tests. */
    now?: () => number;
}
/**
 * One-entry, time-bounded memo for the sessions-root directory index. The scan
 * runs at most once per window per instance, and {@link invalidate} forces the
 * next read to rescan (the owner calls it after its own removals).
 */
export declare class DirIndexCache {
    private readonly memo;
    constructor(options: DirIndexCacheOptions);
    /** The current index: the retained scan while it is fresh, else a new one. */
    get(): SessionDirIndex;
    /** Drop the retained scan; the next {@link get} rescans. */
    invalidate(): void;
    /** Number of real scans this instance performed; diagnostics for tests. */
    get scans(): number;
}
