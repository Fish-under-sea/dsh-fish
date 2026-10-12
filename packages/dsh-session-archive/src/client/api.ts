/**
 * Same-origin HTTP client for the dsh-session-archive host routes.
 * @module @fish-under-sea/dsh-session-archive/client/api
 */

import type {
  ArchiveSessionRow,
  AutoPreviewView,
  BatchResponse,
  InventoryView,
  RunStats,
  SessionPreviewView,
} from '../core/types.ts'

const DEFAULT_TIMEOUT_MS = 30_000
/** Batch deletes of thousands of sessions can take a while server-side. */
const BATCH_TIMEOUT_MS = 300_000

export class ArchiveApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, body: unknown) {
    super(`archive api failed (${status})${typeof body === 'string' ? `: ${body}` : ''}`)
    this.status = status
    this.body = body
  }
}

async function request<T>(path: string, init: RequestInit | undefined, timeoutMs: number): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
    signal: AbortSignal.timeout(timeoutMs),
  })
  const body: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const detail = (typeof body === 'object' && body !== null && 'error' in body && typeof (body as { error: unknown }).error === 'string')
      ? (body as { error: string }).error
      : undefined
    throw new ArchiveApiError(response.status, detail === undefined ? body : `${response.status}: ${detail}`)
  }
  return body as T
}

export interface ArchiveApi {
  inventory(): Promise<InventoryView>
  preview(id: string): Promise<SessionPreviewView>
  archive(ids: string[], currentSessionId?: string): Promise<BatchResponse>
  unarchive(ids: string[]): Promise<BatchResponse>
  deleteSessions(ids: string[], currentSessionId: string | undefined, expectedTotal: number): Promise<BatchResponse>
  autoPreview(): Promise<AutoPreviewView>
  autoRun(kind: 'archive' | 'delete', currentSessionId?: string): Promise<RunStats>
}

function post(ids: string[], extra: Record<string, unknown>): RequestInit {
  return { method: 'POST', body: JSON.stringify({ ids, ...extra }) }
}

export function createArchiveApi(): ArchiveApi {
  // DOCUMENT-RELATIVE (issue #1707): resolved against the served
  // `<base href="./">` so a sub-path deployment reaches the host route.
  const prefix = 'api/dsh-session-archive'
  return {
    inventory: () => request(`${prefix}/inventory`, undefined, DEFAULT_TIMEOUT_MS),
    preview: (id) => request(`${prefix}/preview?id=${encodeURIComponent(id)}`, undefined, DEFAULT_TIMEOUT_MS),
    archive: (ids, currentSessionId) => request(`${prefix}/archive`, post(ids, currentSessionId === undefined ? {} : { currentSessionId }), BATCH_TIMEOUT_MS),
    unarchive: (ids) => request(`${prefix}/unarchive`, post(ids, {}), BATCH_TIMEOUT_MS),
    deleteSessions: (ids, currentSessionId, expectedTotal) => request(
      `${prefix}/delete`,
      post(ids, { ...(currentSessionId === undefined ? {} : { currentSessionId }), expectedTotal }),
      BATCH_TIMEOUT_MS,
    ),
    autoPreview: () => request(`${prefix}/auto/preview`, undefined, DEFAULT_TIMEOUT_MS),
    autoRun: (kind, currentSessionId) => request(
      `${prefix}/auto/run`,
      { method: 'POST', body: JSON.stringify({ kind, ...(currentSessionId === undefined ? {} : { currentSessionId }) }) },
      BATCH_TIMEOUT_MS,
    ),
  }
}

/** Client-side type re-exports for component props. */
export type { ArchiveSessionRow }
