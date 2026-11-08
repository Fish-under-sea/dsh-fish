/**
 * The dsh-session-archive host service. Owns the archive-time ledger, the
 * batch archive/restore/physical-delete pipelines, the automatic policy
 * cycles, and the scheduler. Mutating operations serialize through one
 * operation lock; every per-session step is failure-isolated so one broken
 * session never aborts a batch; physical deletion follows the strict order
 * archive markers -> workspace rows -> storage (rdb rows, files) -> projection
 * cache -> ledger, so an interrupted batch can only ever leave a session
 * present-but-unlisted (retryable), never half-deleted.
 * @module @fish-under-sea/dsh-session-archive-fish/host/janitor
 */
import type { Context } from '@deepseek-ai/cordis';
import { planDelete } from '../core/cascade.ts';
import { type ResolvedAutoConfig } from '../core/config.ts';
import type { ArchiveSessionRow, AutoPreviewView, AutoStateView, BatchResponse, InventoryView, RunStats, SessionPreviewView } from '../core/types.ts';
import { type LedgerDocument } from './ledger.ts';
/** Thrown when the caller's expected delete total disagrees with the host plan. */
export declare class PlanMismatchError extends Error {
    readonly plan: ReturnType<typeof planDelete>;
    constructor(plan: ReturnType<typeof planDelete>);
}
/** Thrown when another mutating operation holds the lock. */
export declare class BusyError extends Error {
    constructor();
}
export interface ArchiveServiceOptions {
    dshHome?: string;
}
/**
 * Ids whose archive time is unknown to the ledger even though the session is
 * archived - sessions archived from the official sidebar, which never reaches
 * this plugin. Their rows carry no `archivedAt`, so the retention clock cannot
 * start for them (`autoDeleteSeedCandidates` skips them) until something
 * records one. The order follows the row order, so a backfill is deterministic.
 *
 * Rows flagged `unreadable` or `no-data` are deliberately excluded. Those flags
 * say the plugin could not read the session's data on this pass, which is
 * usually transient (an unmounted volume, a drive that is not ready, a failed
 * read on a busy host) - the session itself is still there. Recording an
 * archive time for such a row would start a clock that ends in an
 * unrecoverable physical delete, turning a temporary read failure into
 * permanent data loss. They keep "archive time unknown" and stay outside
 * auto-delete, exactly as before this switch existed; once the data reads
 * again the flag clears and the next pass can record the time.
 */
export declare function observedArchiveIds(rows: readonly ArchiveSessionRow[]): string[];
/**
 * Project a set of just-backfilled ids onto a row array: the named rows gain the
 * observation time and its `observed` source, every other row is returned as the
 * very same object. Pure - this is the read-side half of a backfill, so the
 * candidate rules of one cycle see the archive time that cycle records without a
 * second inventory pass, and the preview can show it without writing.
 */
export declare function projectObservedArchives(rows: readonly ArchiveSessionRow[], backfilled: ReadonlySet<string>, now: number): ArchiveSessionRow[];
export declare class ArchiveService {
    private readonly ctx;
    private readonly dshHome;
    private readonly ledgerPath;
    private readonly statePath;
    private ledger;
    private autoState;
    private config;
    /** Per-session projection-cache file facts, memoized across inventory passes. */
    private readonly projcacheFiles;
    /**
     * Sessions-root directory index reused across nearby inventory passes. The
     * scan is the dominant cost of a pass, and one user action triggers several
     * (a chunk per batch request plus the refresh that follows). Invalidation
     * after a physical delete keeps the reuse from reporting removed storage.
     */
    private readonly dirIndex;
    /**
     * Parsed projection-cache index reused across nearby inventory passes. The
     * harness file only changes when another writer touches it, while every pass
     * re-reads and re-parses the whole document; the delete pipeline invalidates
     * the memo after it rewrites the index, so a removed session's facts cannot
     * resurface from memory.
     */
    private readonly projcacheIndex;
    private loaded;
    private disposed;
    /** Fail-fast flag: mutating operations reject with BusyError while held. */
    private lockHeld;
    /** Sessions currently inside an archive/restore/delete pipeline. */
    private readonly busy;
    private cycleRunning;
    private schedulerTimer;
    constructor(ctx: Context, options?: ArchiveServiceOptions);
    start(): Promise<void>;
    stop(): void;
    applyConfig(raw: unknown): void;
    get autoConfig(): ResolvedAutoConfig;
    /** Read-only ledger view for tests and diagnostics. */
    ledgerSnapshot(): LedgerDocument;
    private readFile;
    private flushLedger;
    private flushState;
    /**
     * Record an `observed` ledger entry for every archived row whose archive
     * time is unknown, then persist once - and only when something was written,
     * so a backfill that finds nothing never touches the ledger file.
     *
     * The recorded time is the moment of observation, which is a lower bound on
     * the real archive moment (the session was archived at or before it). Because
     * `autoDeleteSeedCandidates` skips archive times at or after the run start,
     * this also keeps a row out of the delete set of the very cycle that records
     * it.
     *
     * Callers inside a cycle must NOT hold the operation lock (runAutoCycle holds
     * it); this method deliberately takes none.
     * @returns the ids written, in row order.
     */
    private recordObservedArchives;
    private sources;
    private serviceFace;
    /** Live session ids (attached in this host process) — treated as in-use. */
    private liveSessionIds;
    /**
     * Row-level host protection facts the browser half cannot observe: live-store
     * members are `attached`, sessions a mutating operation owns are `in-flight`.
     * `running` (feed flag) and `current` (the client's own session) travel on
     * their own, so the wire carries only what the client cannot see. The
     * `in-flight` write lands last, matching {@link protectedReason}'s precedence.
     */
    private hostProtectedReasons;
    /** Protection map shared by manual delete and auto cycles. */
    private protectedReason;
    private statsFrom;
    inventory(): Promise<InventoryView>;
    autoView(): AutoStateView;
    /** Fail-fast mutual exclusion: concurrent mutating callers get BusyError. */
    private withLock;
    archive(ids: readonly string[], source: 'manual' | 'auto', currentSessionId?: string): Promise<BatchResponse>;
    unarchive(ids: readonly string[]): Promise<BatchResponse>;
    /**
     * Plan and execute one physical-delete batch. The plan is computed from a
     * fresh inventory with the full protection map; `expectedTotal` (the number
     * the user confirmed) must match or the whole batch aborts with a plan
     * mismatch so the UI can re-confirm.
     */
    deleteSessions(ids: readonly string[], options?: {
        currentSessionId?: string;
        expectedTotal?: number;
        source?: 'manual' | 'auto';
    }): Promise<BatchResponse>;
    /**
     * The deletion pipeline, in the crash-safe order: archive markers, then
     * workspace rows, then per-session storage (rdb rows and files), then the
     * projection cache, then the archive ledger. A crash between steps leaves
     * the session unlisted but present — a retry finishes the job; it never
     * leaves a half-deleted session behind.
     */
    private executeDelete;
    /** Best-effort projection-cache scrub; a stale cache entry is cosmetic. */
    private scrubProjcache;
    private readSync;
    autoPreview(): Promise<AutoPreviewView>;
    /**
     * Run one automatic cycle now (scheduler tick or manual trigger). The two
     * policies are independent: archive seeds from last-activity, delete seeds
     * from the recorded archive time strictly before this cycle started, so a
     * session archived by this very cycle is never deleted in it.
     */
    runAutoCycle(kind: 'archive' | 'delete', currentSessionId?: string): Promise<RunStats>;
    /**
     * The backfill-only scheduler step: take the lock, run one inventory pass and
     * record the observed archives. Used when the backfill is the only automatic
     * behaviour this deployment enables, so the recorded archive times still reach
     * the list without an auto-delete cycle. It takes the lock itself and must
     * therefore never be called from inside a cycle (where the lock is held).
     * @returns the number of entries written.
     */
    private cycleObservedArchives;
    /** Archive without re-acquiring the lock (used inside cycles). */
    private archiveInternal;
    private armScheduler;
    private tick;
    preview(id: string): Promise<SessionPreviewView>;
}
/**
 * Tolerant message extraction from session events: user/assistant message
 * events with string or block-array content. Unknown shapes are ignored, so
 * a malformed event never breaks the preview.
 */
export declare function extractMessages(events: readonly unknown[]): {
    total: number;
    excerpt: {
        role: string;
        text: string;
    }[];
};
