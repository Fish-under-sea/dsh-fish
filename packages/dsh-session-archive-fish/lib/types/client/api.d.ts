/**
 * Same-origin HTTP client for the dsh-session-archive host routes.
 * @module @fish-under-sea/dsh-session-archive-fish/client/api
 */
import type { ArchiveSessionRow, AutoPreviewView, BatchResponse, InventoryView, RunStats, SessionPreviewView } from '../core/types.ts';
export declare class ArchiveApiError extends Error {
    readonly status: number;
    readonly body: unknown;
    constructor(status: number, body: unknown);
}
export interface ArchiveApi {
    inventory(): Promise<InventoryView>;
    preview(id: string): Promise<SessionPreviewView>;
    archive(ids: string[], currentSessionId?: string): Promise<BatchResponse>;
    unarchive(ids: string[]): Promise<BatchResponse>;
    deleteSessions(ids: string[], currentSessionId: string | undefined, expectedTotal: number): Promise<BatchResponse>;
    autoPreview(): Promise<AutoPreviewView>;
    autoRun(kind: 'archive' | 'delete', currentSessionId?: string): Promise<RunStats>;
}
export declare function createArchiveApi(): ArchiveApi;
/** Client-side type re-exports for component props. */
export type { ArchiveSessionRow };
