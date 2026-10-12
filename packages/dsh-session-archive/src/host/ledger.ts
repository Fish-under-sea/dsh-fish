/**
 * Host-side persistence for dsh-session-archive: the archive-time ledger and
 * the automatic-policy run state, both as atomic JSON documents under
 * `$DSH_HOME/dsh-session-archive/`. Every write goes through a unique temp
 * file + fsync + rename, so an interrupted write can never produce a
 * half-written document.
 * @module @fish-under-sea/dsh-session-archive/host/ledger
 */

import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { RunStats } from '../core/types.ts'

/** One archive-time record. The ledger only knows archives this plugin made. */
export interface LedgerEntry {
  /** Epoch ms of the archive action (manual or automatic). */
  archivedAt: number
  source: 'manual' | 'auto'
}

export interface LedgerDocument {
  version: 1
  entries: Record<string, LedgerEntry>
}

/** Persisted automatic-policy run state; survives restarts. */
export interface AutoStateDocument {
  version: 1
  lastArchiveRun?: RunStats
  lastDeleteRun?: RunStats
  nextCheckAt?: number
}

export function createLedgerDocument(): LedgerDocument {
  return { version: 1, entries: {} }
}

/** Tolerant deserialize: corrupt or foreign documents start fresh. */
export function deserializeLedger(raw: string): LedgerDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return createLedgerDocument()
  }
  if (typeof parsed !== 'object' || parsed === null) return createLedgerDocument()
  const doc = parsed as { version?: unknown; entries?: unknown }
  if (doc.version !== 1 || typeof doc.entries !== 'object' || doc.entries === null) return createLedgerDocument()
  const entries: Record<string, LedgerEntry> = {}
  for (const [id, value] of Object.entries(doc.entries as Record<string, unknown>)) {
    if (typeof value !== 'object' || value === null) continue
    const entry = value as { archivedAt?: unknown; source?: unknown }
    if (typeof entry.archivedAt !== 'number' || !Number.isFinite(entry.archivedAt)) continue
    if (entry.source !== 'manual' && entry.source !== 'auto') continue
    entries[id] = { archivedAt: entry.archivedAt, source: entry.source }
  }
  return { version: 1, entries }
}

export function deserializeAutoState(raw: string): AutoStateDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { version: 1 }
  }
  if (typeof parsed !== 'object' || parsed === null) return { version: 1 }
  const doc = parsed as { version?: unknown; lastArchiveRun?: RunStats; lastDeleteRun?: RunStats; nextCheckAt?: number }
  if (doc.version !== 1) return { version: 1 }
  const state: AutoStateDocument = { version: 1 }
  if (isRunStats(doc.lastArchiveRun)) state.lastArchiveRun = doc.lastArchiveRun
  if (isRunStats(doc.lastDeleteRun)) state.lastDeleteRun = doc.lastDeleteRun
  if (typeof doc.nextCheckAt === 'number' && Number.isFinite(doc.nextCheckAt)) state.nextCheckAt = doc.nextCheckAt
  return state
}

function isRunStats(value: unknown): value is RunStats {
  if (typeof value !== 'object' || value === null) return false
  const stats = value as Partial<RunStats>
  return typeof stats.at === 'number'
    && typeof stats.total === 'number'
    && typeof stats.ok === 'number'
    && typeof stats.skipped === 'number'
    && typeof stats.failed === 'number'
    && Array.isArray(stats.entries)
}

/** Atomic JSON write: unique temp file, fsync, rename. */
export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`
  try {
    const handle = await open(temp, 'w')
    try {
      await handle.writeFile(JSON.stringify(value, null, 1), 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temp, path)
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}

/** Cap the persisted failure list so state.json stays small. */
export function capEntries(entries: RunStats['entries'], cap = 50): RunStats['entries'] {
  return entries.slice(0, cap)
}
