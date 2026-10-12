/**
 * Bounded reuse of one derived value across nearby readers.
 *
 * Two host-side derivations are recomputed by every inventory pass while
 * changing only when something outside that pass rewrites them: the
 * sessions-root directory walk (see `host/dir-index-cache.ts`) and the parsed
 * harness projection-cache index (`readProjcacheIndex`). One user action
 * triggers several passes (a chunk per batch request plus the refresh that
 * follows it), so the same unchanged input is re-derived each time. This memo
 * serves the previous derivation inside a bounded window instead.
 *
 * Reuse is only sound while the input has not changed underneath us, so the
 * window is short and the owner must invalidate explicitly after it rewrites
 * the input itself. Nothing here polls or accumulates: one entry, and a
 * derivation is always one call away.
 *
 * @module @fish-under-sea/dsh-session-archive/host/ttl-memo
 */

/** Collaborators of one memo instance. */
export interface TtlMemoOptions<T> {
  /** How long a derived value may be reused, in milliseconds. */
  ttlMs: number
  /** Performs the real derivation. */
  load: () => T
  /** Clock reading; defaults to wall time. Injected for deterministic tests. */
  now?: () => number
}

/**
 * One-entry, time-bounded memo for an expensive derivation. The derivation
 * runs at most once per window per instance, and {@link invalidate} forces the
 * next read to derive again (the owner calls it after its own writes).
 */
export class TtlMemo<T> {
  private readonly ttlMs: number
  private readonly load: () => T
  private readonly now: () => number
  private entry: { at: number; value: T } | undefined
  private loadCount = 0

  constructor(options: TtlMemoOptions<T>) {
    this.ttlMs = options.ttlMs
    this.load = options.load
    this.now = options.now ?? (() => Date.now())
  }

  /** The current value: the retained derivation while it is fresh, else a new one. */
  get(): T {
    const at = this.now()
    const entry = this.entry
    if (entry !== undefined && at - entry.at < this.ttlMs && at >= entry.at) return entry.value
    const value = this.load()
    this.loadCount += 1
    this.entry = { at, value }
    return value
  }

  /** Drop the retained value; the next {@link get} derives again. */
  invalidate(): void {
    this.entry = undefined
  }

  /** Number of real derivations this instance performed; diagnostics for tests. */
  get loads(): number {
    return this.loadCount
  }
}
