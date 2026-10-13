/**
 * Browser-side store for the session-archive section: inventory, filters,
 * selection (as an id array — store drafts are plain data), batch progress,
 * preview lifecycle, and the delete-confirmation state.
 * @module @fish-under-sea/dsh-session-archive-fish/client/archive-store
 */

import { defineStore } from '@deepseek-ai/dsh-client-store'
import type { EngineStoreHandle, EngineStoreInstance } from '@deepseek-ai/dsh-client-store'
import type {
  ArchiveSessionRow,
  AutoPreviewView,
  InventoryView,
  OpResult,
  SessionPreviewView,
} from '../core/types.ts'
import { DEFAULT_FILTER_STATE, type FilterState, type SortDir, type SortKey } from '../core/selection.ts'

export type BatchKind = 'archive' | 'unarchive' | 'delete'

export interface BatchProgress {
  kind: BatchKind
  total: number
  processed: number
  results: OpResult[]
  running: boolean
  error: string | null
  freedBytes: number
}

export interface PreviewState {
  id: string
  status: 'loading' | 'ready' | 'error'
  data?: SessionPreviewView
  error?: string
}

export interface ConfirmDeleteState {
  /** Direct ids the user confirmed. */
  ids: string[]
  /** Plan computed from the current client-side inventory snapshot. */
  total: number
  descendants: number
  skippedProtected: number
  totalBytes: number
  /** Extra confirmation checkbox required (select-all or large deletes). */
  strong: boolean
}

export interface ArchiveUiState {
  inventory: InventoryView | null
  status: 'loading' | 'ready' | 'error'
  error: string | null
  filter: FilterState
  sortKey: SortKey
  sortDir: SortDir
  /** Current page (0-based) over the filtered rows; PAGE_SIZE rows per page. */
  page: number
  selection: string[]
  batch: BatchProgress | null
  preview: PreviewState | null
  confirmDelete: ConfirmDeleteState | null
  autoPreview: AutoPreviewView | null
  autoPreviewLoading: boolean
}

export type ArchiveUiActions = {
  setInventory: (draft: ArchiveUiState, inventory: InventoryView) => void
  setStatus: (draft: ArchiveUiState, status: ArchiveUiState['status'], error: string | null) => void
  setFilter: (draft: ArchiveUiState, patch: Partial<FilterState>) => void
  setSort: (draft: ArchiveUiState, key: SortKey, dir: SortDir) => void
  setPage: (draft: ArchiveUiState, page: number) => void
  toggleRow: (draft: ArchiveUiState, id: string, on: boolean) => void
  selectMany: (draft: ArchiveUiState, ids: readonly string[], on: boolean) => void
  clearSelection: (draft: ArchiveUiState) => void
  startBatch: (draft: ArchiveUiState, kind: BatchKind, total: number) => void
  batchChunk: (draft: ArchiveUiState, results: readonly OpResult[], freedBytes: number) => void
  finishBatch: (draft: ArchiveUiState, error: string | null, freedBytes: number) => void
  closeBatch: (draft: ArchiveUiState) => void
  setPreview: (draft: ArchiveUiState, preview: PreviewState | null) => void
  setConfirmDelete: (draft: ArchiveUiState, state: ConfirmDeleteState | null) => void
  setAutoPreview: (draft: ArchiveUiState, preview: AutoPreviewView | null, loading: boolean) => void
}

export function createArchiveStore(): EngineStoreHandle<ArchiveUiState, ArchiveUiActions> {
  return defineStore({
    init: (): ArchiveUiState => ({
      inventory: null,
      status: 'loading',
      error: null,
      filter: { ...DEFAULT_FILTER_STATE },
      sortKey: 'lastActivity',
      sortDir: 'desc',
      page: 0,
      selection: [],
      batch: null,
      preview: null,
      confirmDelete: null,
      autoPreview: null,
      autoPreviewLoading: false,
    }),
    actions: {
      setInventory: (draft, inventory) => {
        draft.inventory = inventory
        draft.status = 'ready'
        draft.error = null
        // Drop selected ids whose rows no longer exist (deleted in a batch or
        // removed elsewhere) so the counter reflects what is selectable.
        // Selection across FILTER changes is preserved; this only prunes ids
        // the inventory no longer knows.
        if (draft.selection.length > 0) {
          const alive = new Set(inventory.rows.map((row) => row.id))
          const pruned = draft.selection.filter((id) => alive.has(id))
          if (pruned.length !== draft.selection.length) draft.selection = pruned
        }
      },
      setStatus: (draft, status, error) => {
        draft.status = status
        draft.error = error
      },
      setFilter: (draft, patch) => {
        draft.filter = { ...draft.filter, ...patch }
        draft.page = 0
      },
      setSort: (draft, key, dir) => {
        draft.sortKey = key
        draft.sortDir = dir
        draft.page = 0
      },
      setPage: (draft, page) => {
        draft.page = Math.max(0, page)
      },
      toggleRow: (draft, id, on) => {
        const has = draft.selection.includes(id)
        if (on && !has) draft.selection.push(id)
        if (!on && has) draft.selection = draft.selection.filter((entry) => entry !== id)
      },
      selectMany: (draft, ids, on) => {
        const set = new Set(draft.selection)
        for (const id of ids) {
          if (on) set.add(id)
          else set.delete(id)
        }
        draft.selection = [...set]
      },
      clearSelection: (draft) => {
        draft.selection = []
      },
      startBatch: (draft, kind, total) => {
        draft.batch = { kind, total, processed: 0, results: [], running: true, error: null, freedBytes: 0 }
      },
      batchChunk: (draft, results, freedBytes) => {
        if (draft.batch === undefined || draft.batch === null) return
        // The server repeats the protected skips the client already resolved
        // locally; keep one entry per session id.
        const known = new Set(draft.batch.results.map((entry) => entry.id))
        const fresh = results.filter((entry) => !known.has(entry.id))
        draft.batch.results.push(...fresh)
        draft.batch.processed += fresh.length
        draft.batch.freedBytes += freedBytes
      },
      finishBatch: (draft, error, freedBytes) => {
        if (draft.batch === undefined || draft.batch === null) return
        draft.batch.running = false
        draft.batch.error = error
        if (draft.batch.freedBytes === 0 && error === null) draft.batch.freedBytes = freedBytes
      },
      closeBatch: (draft) => {
        draft.batch = null
      },
      setPreview: (draft, preview) => {
        draft.preview = preview
      },
      setConfirmDelete: (draft, state) => {
        draft.confirmDelete = state
      },
      setAutoPreview: (draft, preview, loading) => {
        draft.autoPreview = preview
        draft.autoPreviewLoading = loading
      },
    },
  })
}

export type ArchiveStoreInstance = EngineStoreInstance<ArchiveUiState, ArchiveUiActions>

/** Row lookup helper for controllers and dialogs. */
export function rowMap(rows: readonly ArchiveSessionRow[]): Map<string, ArchiveSessionRow> {
  return new Map(rows.map((row) => [row.id, row]))
}
