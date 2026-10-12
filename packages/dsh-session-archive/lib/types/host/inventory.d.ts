/**
 * Inventory assembly: one pass over the authoritative session feed (host
 * SessionController — cold sessions included, agents never activated), the
 * workspace registry (membership + archive set), the projection-cache index
 * plus per-session projection-cache files (titles, creation facts — the
 * index only covers recent sessions), the on-disk session directories
 * (sizes, sessions missing from the feed), and the plugin's own archive-time
 * ledger. The result is the single document the browser half renders and
 * plans against.
 * @module @fish-under-sea/dsh-session-archive/host/inventory
 */
import type { ArchiveSessionRow, WorkspaceView } from '../core/types.ts';
import type { LedgerDocument } from './ledger.ts';
import { type SessionDirIndex } from './session-files.ts';
/** Minimal duck-typed face of the host SessionController feed. */
export interface SessionFeedFace {
    list(request: unknown, signal: AbortSignal): Promise<{
        items?: readonly {
            sessionId?: string;
            updatedAt?: number;
            running?: boolean;
            blank?: boolean;
            parentSessionId?: string;
            origin?: string;
            cwd?: string;
        }[];
    }>;
}
/** Minimal duck-typed face of the host WorkspaceRegistry. */
export interface WorkspaceRegistryFace {
    list(): readonly {
        id: string;
        path: string;
        title: string;
        sessionIds: readonly string[];
    }[];
    archivedSessionIds: readonly string[];
}
export interface InventorySources {
    feed: SessionFeedFace | undefined;
    registry: WorkspaceRegistryFace | undefined;
    dshHome: string;
    ledger: LedgerDocument;
    /**
     * Optional per-id cache for the per-session projection-cache files the
     * fallback reads; the service passes one so repeated inventory passes do
     * not re-read unchanged files.
     */
    projcacheFiles?: Map<string, ProjcacheFileEntry | null>;
    /**
     * Optional prebuilt sessions-root index. The service passes one so nearby
     * passes (a batch request each chunk plus the refresh that follows it) reuse
     * the same directory walk instead of re-walking an unchanged tree; absent
     * means this pass walks the tree itself.
     */
    dirIndex?: SessionDirIndex;
    /**
     * Optional parsed projection-cache index. The service passes one for the
     * same reason as {@link dirIndex}: every pass would otherwise re-read and
     * re-parse the whole index document, which is the dominant remaining cost of
     * a pass whose directory walk was already reused; absent means this pass
     * reads and parses the file itself.
     */
    projcacheIndex?: ProjcacheIndex;
}
/** Enrichment facts from one per-session projection-cache file. */
export interface ProjcacheFileEntry {
    title?: string;
    createdAt?: number;
    cwd?: string;
}
/** Title/createdAt/cwd enrichment rows from the harness projection cache. */
export interface ProjcacheIndex {
    sessions: Record<string, {
        identity?: {
            createdAt?: number;
            cwd?: string;
        };
        rows?: {
            title?: {
                val?: unknown;
            };
            goal?: {
                val?: unknown;
            };
        };
    }>;
}
/**
 * Read and parse the aggregate projection-cache index. A missing or
 * unparseable file degrades to an empty index rather than failing the pass.
 */
export declare function readProjcacheIndex(dshHome: string): ProjcacheIndex;
/**
 * Fallback enrichment from one per-session projection-cache file
 * (`storages/session_projcache/sessions/<id>.json`). The aggregate index
 * only covers recent sessions, so older/archived rows fall back to these
 * files for title/createdAt/cwd. Tolerant of version and shape drift; a
 * missing or unreadable file yields undefined.
 */
export declare function readProjcacheFile(dshHome: string, id: string, cache?: InventorySources['projcacheFiles']): Promise<ProjcacheFileEntry | undefined>;
export interface BuiltInventory {
    rows: ArchiveSessionRow[];
    workspaces: WorkspaceView[];
    archivedSessionIds: string[];
    dirIndex: SessionDirIndex;
    /**
     * Canonical row id -> the id the harness natively uses for the session.
     * Harness installs mix id spellings (feed, archive set, and store may hold
     * bare uuids while other rows carry `session-<uuid>`); every id this module
     * emits is canonical, and harness-facing calls must pass the native form.
     */
    nativeIds: Record<string, string>;
}
/** Ledger entry for a session under either id spelling; canonical wins. */
export declare function ledgerEntryFor(ledger: LedgerDocument, canonicalId: string, nativeId?: string): {
    archivedAt: number;
    source: 'manual' | 'auto';
} | undefined;
/**
 * Build the full inventory. Rows exist only for sessions the feed lists or
 * the sessions root contains — projection-cache or ledger entries alone never
 * conjure a row (no ghosts). Rows from the feed carry reliable last-activity
 * times; disk-only rows are flagged `unreadable` metadata.
 */
export declare function buildInventory(sources: InventorySources, signal: AbortSignal): Promise<BuiltInventory>;
export declare function emptyLedger(): LedgerDocument;
