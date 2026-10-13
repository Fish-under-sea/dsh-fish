/**
 * Browser-side store for the session-archive section: inventory, filters,
 * selection (as an id array — store drafts are plain data), batch progress,
 * preview lifecycle, and the delete-confirmation state.
 * @module @fish-under-sea/dsh-session-archive-fish/client/archive-store
 */
import type { EngineStoreHandle, EngineStoreInstance } from '@deepseek-ai/dsh-client-store';
import type { ArchiveSessionRow, AutoPreviewView, InventoryView, OpResult, SessionPreviewView } from '../core/types.ts';
import { type FilterState, type SortDir, type SortKey } from '../core/selection.ts';
export type BatchKind = 'archive' | 'unarchive' | 'delete';
export interface BatchProgress {
    kind: BatchKind;
    total: number;
    processed: number;
    results: OpResult[];
    running: boolean;
    error: string | null;
    freedBytes: number;
}
export interface PreviewState {
    id: string;
    status: 'loading' | 'ready' | 'error';
    data?: SessionPreviewView;
    error?: string;
}
export interface ConfirmDeleteState {
    /** Direct ids the user confirmed. */
    ids: string[];
    /** Plan computed from the current client-side inventory snapshot. */
    total: number;
    descendants: number;
    skippedProtected: number;
    totalBytes: number;
    /** Extra confirmation checkbox required (select-all or large deletes). */
    strong: boolean;
}
export interface ArchiveUiState {
    inventory: InventoryView | null;
    status: 'loading' | 'ready' | 'error';
    error: string | null;
    filter: FilterState;
    sortKey: SortKey;
    sortDir: SortDir;
    /** Current page (0-based) over the filtered rows; PAGE_SIZE rows per page. */
    page: number;
    selection: string[];
    batch: BatchProgress | null;
    preview: PreviewState | null;
    confirmDelete: ConfirmDeleteState | null;
    autoPreview: AutoPreviewView | null;
    autoPreviewLoading: boolean;
}
export type ArchiveUiActions = {
    setInventory: (draft: ArchiveUiState, inventory: InventoryView) => void;
    setStatus: (draft: ArchiveUiState, status: ArchiveUiState['status'], error: string | null) => void;
    setFilter: (draft: ArchiveUiState, patch: Partial<FilterState>) => void;
    setSort: (draft: ArchiveUiState, key: SortKey, dir: SortDir) => void;
    setPage: (draft: ArchiveUiState, page: number) => void;
    toggleRow: (draft: ArchiveUiState, id: string, on: boolean) => void;
    selectMany: (draft: ArchiveUiState, ids: readonly string[], on: boolean) => void;
    clearSelection: (draft: ArchiveUiState) => void;
    startBatch: (draft: ArchiveUiState, kind: BatchKind, total: number) => void;
    batchChunk: (draft: ArchiveUiState, results: readonly OpResult[], freedBytes: number) => void;
    finishBatch: (draft: ArchiveUiState, error: string | null, freedBytes: number) => void;
    closeBatch: (draft: ArchiveUiState) => void;
    setPreview: (draft: ArchiveUiState, preview: PreviewState | null) => void;
    setConfirmDelete: (draft: ArchiveUiState, state: ConfirmDeleteState | null) => void;
    setAutoPreview: (draft: ArchiveUiState, preview: AutoPreviewView | null, loading: boolean) => void;
};
export declare function createArchiveStore(): EngineStoreHandle<ArchiveUiState, ArchiveUiActions>;
export type ArchiveStoreInstance = EngineStoreInstance<ArchiveUiState, ArchiveUiActions>;
/** Row lookup helper for controllers and dialogs. */
export declare function rowMap(rows: readonly ArchiveSessionRow[]): Map<string, ArchiveSessionRow>;
