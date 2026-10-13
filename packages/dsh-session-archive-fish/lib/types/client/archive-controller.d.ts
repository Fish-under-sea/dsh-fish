/**
 * The browser-side controller: owns the API client and the store, runs the
 * chunked batch pipelines (family-partitioned for delete), computes the
 * confirm-dialog delete plan with the same core rules the host enforces, and
 * drives preview/auto-preview fetches.
 * @module @fish-under-sea/dsh-session-archive-fish/client/archive-controller
 */
import type { ArchiveSessionRow, DeletePlanView, OpResult } from '../core/types.ts';
import { type ArchiveApi } from './api.ts';
import { type ArchiveStoreInstance, type BatchKind } from './archive-store.ts';
export interface ArchiveControllerDeps {
    api?: ArchiveApi;
    store?: ArchiveStoreInstance;
    /**
     * The client sessions face: the main-view Session resolver and the feed
     * refresh. The Client Session Controller carries no global selection since
     * 0.1.6-alpha.2, so the wiring resolves the main-view Session and this port
     * takes the resolved id rather than the catalog shape.
     */
    sessions?: {
        current?: () => string | undefined;
        refresh?: () => Promise<void>;
    };
}
/** Partition delete targets into family-intact chunks of at most CHUNK_SIZE. */
export declare function chunkDeleteTargets(rows: readonly ArchiveSessionRow[], targets: readonly string[]): string[][];
/** Plain fixed-size chunking for archive/unarchive. */
export declare function chunkPlain(ids: readonly string[], size?: number): string[][];
export declare class ArchiveController {
    readonly store: ArchiveStoreInstance;
    private readonly api;
    private readonly sessions?;
    constructor(deps?: ArchiveControllerDeps);
    /** The main-view Session id from the sessions face, when available. */
    getCurrentSessionId(): string | undefined;
    private currentSessionId;
    load(): Promise<void>;
    /** The delete plan the confirm dialog shows, from the current snapshot. */
    planDeleteFor(directIds: readonly string[]): {
        plan: DeletePlanView;
        totalBytes: number;
    };
    confirmDelete(directIds: readonly string[]): Promise<void>;
    /** Execute one batch kind over explicit ids, updating progress per chunk. */
    runBatch(kind: BatchKind, directIds: readonly string[]): Promise<void>;
    /** Retry only the failed ids of the last batch, same kind. */
    retryFailed(): Promise<void>;
    openPreview(id: string): Promise<void>;
    refreshAutoPreview(): Promise<void>;
    runAuto(kind: 'archive' | 'delete'): Promise<void>;
}
export type { OpResult };
